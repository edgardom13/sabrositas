import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Carrito } from '../../services/carrito';
import { SupabaseService } from '../../services/supabase';

@Component({
  selector: 'app-boton-carrito',
  imports: [FormsModule],
  templateUrl: './boton-carrito.html',
  styleUrl: './boton-carrito.css',
})
export class BotonCarrito {
  carrito = inject(Carrito);
  supabase = inject(SupabaseService);
  private sanitizer = inject(DomSanitizer);

  panelAbierto = false;

  readonly NUMERO_WHATSAPP = '57301607084';
  readonly DOMICILIO = 3000;

  nombre = '';
  apellido = '';
  telefono = '';
  direccion = '';
  formularioValido = true;

  // ===== Ubicación en tiempo real =====
  lat: number | null = null;
  lng: number | null = null;
  mapaUrl: SafeResourceUrl | null = null;
  obteniendoUbicacion = false;
  errorUbicacion = '';
  mostrarInfo = false;

  formatearPrecio(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }

  alternarPanel(): void {
    this.panelAbierto = !this.panelAbierto;
  }

  totalConDomicilio(): number {
    return this.carrito.totalPedido() - this.carrito.descuento() + this.DOMICILIO;
  }

  // 📍 Detecta la ubicación del cliente en tiempo real
usarMiUbicacion(): void {
  this.errorUbicacion = '';

  if (!window.isSecureContext) {
    this.errorUbicacion =
      '⚠️ Tu navegador solo permite geolocalización en sitios con https (o localhost). Escribe tu dirección manualmente.';
    return;
  }

  if (!navigator.geolocation) {
    this.errorUbicacion = 'Tu navegador no soporta geolocalización. Escribe tu dirección manualmente.';
    return;
  }

  this.obteniendoUbicacion = true;

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      this.lat = pos.coords.latitude;
      this.lng = pos.coords.longitude;
      this.actualizarMapa();

      // ✍️ Escribe la dirección en el input apenas se obtiene el GPS
      await this.detectarDireccion();

      this.obteniendoUbicacion = false;
    },
    (err) => {
      this.obteniendoUbicacion = false;

      if (err.code === err.PERMISSION_DENIED) {
        this.errorUbicacion = '🚫 Permiso denegado. Actívalo en los ajustes del navegador o escribe tu dirección.';
      } else if (err.code === err.POSITION_UNAVAILABLE) {
        this.errorUbicacion = '🌐 No hay señal de ubicación disponible. Escríbela manualmente.';
      } else {
        this.errorUbicacion = '⏱️ El GPS tardó demasiado. Intenta de nuevo o escribe tu dirección.';
      }
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
  );
}

// ✍️ Convierte las coordenadas en una dirección escrita (con respaldos)
private async detectarDireccion(): Promise<void> {
  if (this.lat === null || this.lng === null) return;
  const lat = this.lat;
  const lng = this.lng;

  // Intento 1: OpenStreetMap (dirección corta y en español)
  try {
    const resp = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`,
    );
    if (resp.ok) {
      const data = await resp.json();
      const a = data?.address ?? {};
      const corta = [
        a.road,
        a.house_number,
        a.neighbourhood || a.suburb,
        a.city || a.town || a.village,
        a.state,
      ]
        .filter(Boolean)
        .join(', ');

      if (corta) {
        this.direccion = corta;
        return;
      }
      if (data?.display_name) {
        this.direccion = data.display_name;
        return;
      }
    }
  } catch {
    // pasa al intento 2
  }

  // Intento 2: BigDataCloud (gratis, sin clave)
  try {
    const resp = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`,
    );
    if (resp.ok) {
      const data = await resp.json();
      const partes = [data.locality, data.city, data.principalSubdivision, data.countryName]
        .filter(Boolean)
        .join(', ');
      if (partes) {
        this.direccion = partes;
        return;
      }
    }
  } catch {
    // pasa al respaldo final
  }

  // Respaldo final: siempre queda una referencia con coordenadas
  this.direccion = `Ubicación detectada (GPS): ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

  // 🔍 Busca la dirección escrita y la muestra en el mapa
  async buscarEnMapa(): Promise<void> {
    if (!this.direccion.trim()) return;
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(this.direccion)}`,
      );
      const data = await resp.json();
      if (data.length > 0) {
        this.lat = parseFloat(data[0].lat);
        this.lng = parseFloat(data[0].lon);
        this.errorUbicacion = '';
        this.actualizarMapa();
      } else {
        this.errorUbicacion = 'No encontramos esa dirección en el mapa, pero puedes continuar con tu pedido.';
      }
    } catch {
      this.errorUbicacion = 'No se pudo buscar en el mapa, pero puedes continuar con tu pedido.';
    }
  }

  private actualizarMapa(): void {
    if (this.lat !== null && this.lng !== null) {
      this.mapaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://maps.google.com/maps?q=${this.lat},${this.lng}&z=17&output=embed`,
      );
    } else {
      this.mapaUrl = null;
    }
  }

  async enviarPedido(): Promise<void> {
    this.formularioValido =
      this.nombre.trim() !== '' &&
      this.apellido.trim() !== '' &&
      this.telefono.trim() !== '' &&
      this.direccion.trim() !== '';

    if (!this.formularioValido) return;

    const items = this.carrito.itemsSignal();
    const subtotal = this.carrito.totalPedido();
    const descuento = this.carrito.descuento();
    const total = subtotal - descuento + this.DOMICILIO;

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const hora = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });

    const numeroPedido = `${ahora.getHours().toString().padStart(2, '0')}${ahora
      .getMinutes().toString().padStart(2, '0')}`;

    const lineasProductos = items
      .map(
        (i, index) =>
          `   ${index + 1}. *${i.cantidad}* x ${i.producto.nombre} ${this.emojiDe(i.producto.nombre)} — _${this.formatearPrecio(i.cantidad * i.producto.precio)}_`,
      )
      .join('\n');

    // 🗺️ Link del mapa para el domiciliario
    const linkMapa =
      this.lat !== null && this.lng !== null
        ? `\n   🗺️ *Ver ubicación en el mapa:* https://www.google.com/maps?q=${this.lat},${this.lng}`
        : '';

    const mensaje =
      `┏━━━━━━━━━━━━━━━━━━━━━━┓\n` +
      `   🥟 *SABROSITAS* 🥟\n` +
      `   _Empanadas Fritas_\n` +
      `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
      `📝 *NUEVO PEDIDO #${numeroPedido}*\n` +
      `📅 ${fecha}\n` +
      `🕒 ${hora}\n\n` +
      `╭─────────────────────╮\n` +
      `│   🛒 *DETALLE DEL PEDIDO*\n` +
      `╰─────────────────────╯\n` +
      `${lineasProductos}\n\n` +
      `╭─────────────────────╮\n` +
      `│   💰 *RESUMEN*\n` +
      `╰─────────────────────╯\n` +
      `   🧾 Subtotal: *${this.formatearPrecio(subtotal)}*\n` +
      (descuento > 0 ? `   🎁 Cupón 10%: *-${this.formatearPrecio(descuento)}*\n` : '') +
      `   🛵 Domicilio: *${this.formatearPrecio(this.DOMICILIO)}*\n` +
      `   ━━━━━━━━━━━━━━━━\n` +
      `   💵 *TOTAL A PAGAR: ${this.formatearPrecio(total)}*\n\n` +
      `╭─────────────────────╮\n` +
      `│   📍 *DATOS DE ENTREGA*\n` +
      `╰─────────────────────╯\n` +
      `   👤 *Cliente:* ${this.nombre.trim()} ${this.apellido.trim()}\n` +
      `   📞 *Teléfono:* ${this.telefono.trim()}\n` +
      `   🏠 *Dirección:* ${this.direccion.trim()}` +
      linkMapa + `\n\n` +
      `✨ _¡Gracias por elegir Sabrositas!_\n` +
      `❤️ _Prepararemos tu pedido con mucho amor._\n` +
      `🥟 _¡Que lo disfrutes!_`;

    // 💾 Guardamos en Supabase (con coordenadas)
    await this.supabase.registrarPedido({
      nombre_cliente: this.nombre.trim(),
      apellido_cliente: this.apellido.trim(),
      telefono: this.telefono.trim(),
      direccion: this.direccion.trim(),
      items: items.map((i) => ({
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precio: i.producto.precio,
      })),
      subtotal,
      descuento,
      domicilio: this.DOMICILIO,
      total,
      lat: this.lat,
      lng: this.lng,
    });

    // 📲 Abrimos WhatsApp
    window.open(
      `https://wa.me/${this.NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`,
      '_blank',
    );

    // 🧹 Limpiamos todo
    this.carrito.vaciar();
    this.nombre = '';
    this.apellido = '';
    this.telefono = '';
    this.direccion = '';
    this.lat = null;
    this.lng = null;
    this.mapaUrl = null;
    this.errorUbicacion = '';
    this.panelAbierto = false;
  }

  private emojiDe(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('carne')) return '🥩';
    if (n.includes('pollo')) return '🍗';
    if (n.includes('maíz') || n.includes('maiz')) return '🌽';
    if (n.includes('corozo')) return '🍒';
    if (n.includes('queso')) return '🧀';
    return '🥟';
  }
}
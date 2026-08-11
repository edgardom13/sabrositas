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

        // Rellena la dirección automáticamente (servicio gratuito)
        try {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${this.lat}&lon=${this.lng}`,
          );
          const data = await resp.json();
          if (data?.display_name && !this.direccion.trim()) {
            this.direccion = data.display_name;
          }
        } catch {
          // Si falla, el cliente la escribe a mano
        }
        this.obteniendoUbicacion = false;
      },
      () => {
        this.obteniendoUbicacion = false;
        this.errorUbicacion = 'No pudimos obtener tu ubicación. Actívala o escribe la dirección manualmente.';
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
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
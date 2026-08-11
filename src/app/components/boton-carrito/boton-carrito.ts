import { Component, inject, NgZone, ChangeDetectorRef } from '@angular/core';
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
  private ngZone = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  panelAbierto = false;
  mostrarModal = false; // ← modal de confirmación
  enviandoPedido = false;

  readonly NUMERO_WHATSAPP = '573012680659';
  readonly DOMICILIO = 3000;
  readonly GOOGLE_MAPS_KEY = 'AIzaSyDt-zm7q0nwoGYcZR8fzsUtioYMXz_bauk';

  nombre = '';
  apellido = '';
  telefono = '';
  direccion = '';
  formularioValido = true;

  lat: number | null = null;
  lng: number | null = null;
  mapaUrl: SafeResourceUrl | null = null;
  obteniendoUbicacion = false;
  errorUbicacion = '';
  mostrarInfo = false;

  private timeoutBusqueda: ReturnType<typeof setTimeout> | null = null;

  formatearPrecio(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }

  alternarPanel(): void {
    this.panelAbierto = !this.panelAbierto;
  }

  totalConDomicilio(): number {
    return this.carrito.totalPedido() - this.carrito.descuento() + this.DOMICILIO;
  }

  onDireccionChange(): void {
    if (this.timeoutBusqueda) {
      clearTimeout(this.timeoutBusqueda);
    }
    this.timeoutBusqueda = setTimeout(() => {
      this.buscarEnMapa();
    }, 1000);
  }

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
    this.cdr.detectChanges();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.ngZone.run(async () => {
          this.lat = pos.coords.latitude;
          this.lng = pos.coords.longitude;
          this.actualizarMapa();
          this.cdr.detectChanges();

          await this.detectarDireccion();

          this.obteniendoUbicacion = false;
          this.cdr.detectChanges();
        });
      },
      (err) => {
        this.ngZone.run(() => {
          this.obteniendoUbicacion = false;

          if (err.code === err.PERMISSION_DENIED) {
            this.errorUbicacion = '🚫 Permiso denegado. Actívalo en los ajustes del navegador o escribe tu dirección.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            this.errorUbicacion = '🌐 No hay señal de ubicación disponible. Escríbela manualmente.';
          } else {
            this.errorUbicacion = '⏱️ El GPS tardó demasiado. Intenta de nuevo o escribe tu dirección.';
          }
          this.cdr.detectChanges();
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  private async detectarDireccion(): Promise<void> {
    if (this.lat === null || this.lng === null) return;
    const lat = this.lat;
    const lng = this.lng;

    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=es&key=${this.GOOGLE_MAPS_KEY}`,
      );

      if (resp.ok) {
        const data = await resp.json();
        if (data.status === 'OK' && data.results?.length > 0) {
          const resultado = data.results[0];
          const comps: { types: string[]; long_name: string }[] =
            resultado.address_components ?? [];

          const obtener = (...tipos: string[]) => {
            const comp = comps.find((c) => tipos.some((t) => c.types.includes(t)));
            return comp?.long_name ?? '';
          };

          const calle = obtener('route');
          const numero = obtener('street_number');
          const barrio = obtener('neighborhood', 'sublocality_level_1', 'sublocality');
          const ciudad = obtener('locality');
          const departamento = obtener('administrative_area_level_1');

          const direccionCompleta = [
            calle && numero ? `${calle} #${numero}` : calle,
            barrio ? `Barrio ${barrio}` : '',
            ciudad,
            departamento,
          ]
            .filter(Boolean)
            .join(', ');

          if (direccionCompleta) {
            this.direccion = direccionCompleta;
            this.cdr.detectChanges();
            return;
          }

          if (resultado.formatted_address) {
            this.direccion = resultado.formatted_address;
            this.cdr.detectChanges();
            return;
          }
        }
      }
    } catch {}

    try {
      const resp = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=es`);
      if (resp.ok) {
        const p = (await resp.json())?.features?.[0]?.properties;
        if (p) {
          const calle = p.street ? `${p.street}${p.housenumber ? ' #' + p.housenumber : ''}` : p.name || '';
          const direccion = [
            calle,
            p.district ? `Barrio ${p.district}` : '',
            p.city || p.town || p.village,
            p.state,
          ].filter(Boolean).join(', ');

          if (direccion) {
            this.direccion = direccion;
            this.cdr.detectChanges();
            return;
          }
        }
      }
    } catch {}

    this.direccion = `Ubicación GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    this.cdr.detectChanges();
  }

  async buscarEnMapa(): Promise<void> {
    if (!this.direccion.trim()) return;

    try {
      const resp = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(this.direccion)}&language=es&key=${this.GOOGLE_MAPS_KEY}`,
      );
      const data = await resp.json();

      if (data.status === 'OK' && data.results?.length > 0) {
        const location = data.results[0].geometry.location;
        this.lat = location.lat;
        this.lng = location.lng;
        this.errorUbicacion = '';
        this.actualizarMapa();
        this.cdr.detectChanges();
      } else {
        console.warn('⚠️ No se encontró la dirección');
      }
    } catch {}
  }

  private actualizarMapa(): void {
    if (this.lat !== null && this.lng !== null) {
      this.mapaUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://maps.google.com/maps?q=${this.lat},${this.lng}&z=18&output=embed`,
      );
    } else {
      this.mapaUrl = null;
    }
  }

  // 🎯 NUEVO: Validar y mostrar modal de confirmación
  enviarPedido(): void {
    this.formularioValido =
      this.nombre.trim() !== '' &&
      this.apellido.trim() !== '' &&
      this.telefono.trim() !== '' &&
      this.direccion.trim() !== '';

    if (!this.formularioValido) return;

    // Mostrar el modal en vez de enviar directamente
    this.mostrarModal = true;
  }

  // ✅ NUEVO: El cliente confirmó, ahora sí se envía
  async confirmarEnvio(): Promise<void> {
    if (this.enviandoPedido) return;
    this.enviandoPedido = true;

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

    window.open(
      `https://wa.me/${this.NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`,
      '_blank',
    );

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
    this.mostrarModal = false;
    this.enviandoPedido = false;
  }

  // ❌ NUEVO: El cliente canceló, cerrar modal y seguir editando
  cancelarEnvio(): void {
    this.mostrarModal = false;
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


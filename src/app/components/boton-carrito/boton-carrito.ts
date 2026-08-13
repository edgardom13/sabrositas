import { Component, inject, NgZone, ChangeDetectorRef, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Carrito } from '../../services/carrito';
import { SupabaseService } from '../../services/supabase';
import { ConfigService } from '../../services/config.service';
import { ProductosService } from '../../services/productos.service';

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
  private configService = inject(ConfigService);
  private productosService = inject(ProductosService);

  panelAbierto = false;
  mostrarModal = false;
  enviandoPedido = false;

  readonly GOOGLE_MAPS_KEY = 'AIzaSyDt-zm7q0nwoGYcZR8fzsUtioYMXz_bauk';

  get NUMERO_WHATSAPP(): string {
    return this.configService.config().whatsapp;
  }

  get DOMICILIO(): number {
    return this.configService.config().domicilio;
  }

  nombre = '';
  apellido = '';
  telefono = '';
  direccion = '';
  formularioValido = true;

  // 🎟️ Cupón de canje (código CANJE-XXXX del cliente) — ahora con tipo, valor y cantidad
  codigoCanje = '';
  validandoCanje = signal(false);
  canjeValido = signal<{ id: number; premio: string; tipo: string; valor: number; cantidad: number } | null>(null);
  errorCanje = signal<string | null>(null);
  canjeAutoAplicado = signal(false);

  lat: number | null = null;
  lng: number | null = null;
  mapaUrl: SafeResourceUrl | null = null;
  obteniendoUbicacion = false;
  errorUbicacion = '';
  mostrarInfo = false;

  private timeoutBusqueda: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.configService.cargar();

    // 🎯 Si hay un canje pendiente en localStorage, aplicarlo automáticamente
    const codigoPendiente = localStorage.getItem('canje_pendiente');
    if (codigoPendiente) {
      this.codigoCanje = codigoPendiente;
      localStorage.removeItem('canje_pendiente');

      setTimeout(() => {
        this.validarCanje().then(() => {
          if (this.canjeValido()) {
            this.canjeAutoAplicado.set(true);
            this.panelAbierto = true;
          }
        });
      }, 300);
    }
  }

  formatearPrecio(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }

  alternarPanel(): void {
    this.panelAbierto = !this.panelAbierto;
  }

  // ✅ Total final coherente con cupón + canje + domicilio ajustado
  totalConDomicilio(): number {
    return (
      this.carrito.totalPedido() -
      this.carrito.descuento() -
      this.descuentoCanje() +
      this.domicilioFinal()
    );
  }

  // ===== 💰 Descuento que aplica el canje según el tipo de premio (con cantidad) =====
 descuentoCanje(): number {
    const canje = this.canjeValido();
    if (!canje) return 0;

    switch (canje.tipo) {
      case 'empanada': {
        const enCarrito = this.carrito.itemsSignal().filter((i) => i.producto.categoria === 'empanada');
        const precio = enCarrito.length
          ? Math.min(...enCarrito.map((i) => i.producto.precio))
          : (this.productosService.catalogo().find((x) => x.categoria === 'empanada')?.precio ?? 2000);
        const unidadesEnCarrito = enCarrito.reduce((t, i) => t + i.cantidad, 0);
        const unidades = unidadesEnCarrito > 0 ? Math.min(canje.cantidad, unidadesEnCarrito) : canje.cantidad;
        return precio * unidades;
      }
      case 'jugo': {
        const enCarrito = this.carrito.itemsSignal().filter((i) => i.producto.categoria === 'jugo');
        const precio = enCarrito.length
          ? Math.min(...enCarrito.map((i) => i.producto.precio))
          : (this.productosService.catalogo().find((x) => x.categoria === 'jugo')?.precio ?? 2000);
        const unidadesEnCarrito = enCarrito.reduce((t, i) => t + i.cantidad, 0);
        const unidades = unidadesEnCarrito > 0 ? Math.min(canje.cantidad, unidadesEnCarrito) : canje.cantidad;
        return precio * unidades;
      }
      case 'domicilio':
        return this.DOMICILIO;
      case 'monto':
        return canje.valor;
      default:
        return 0; // 'otro' se entrega físico
    }
  }

  domicilioFinal(): number {
    return this.canjeValido()?.tipo === 'domicilio' ? 0 : this.DOMICILIO;
  }

  async validarCanje(): Promise<void> {
    const codigo = this.codigoCanje.trim().toUpperCase();
    if (!codigo) {
      this.canjeValido.set(null);
      this.errorCanje.set(null);
      return;
    }

    this.validandoCanje.set(true);
    this.errorCanje.set(null);
    this.canjeValido.set(null);

    const { data, error } = await this.supabase.client
      .from('canjes')
      .select('id, estado, premio:premios(nombre, tipo, valor, cantidad)')
      .eq('codigo', codigo)
      .maybeSingle();

    this.validandoCanje.set(false);

    if (error || !data) {
      this.errorCanje.set('❌ Código no válido');
      return;
    }

    if (data.estado !== 'pendiente') {
      this.errorCanje.set(data.estado === 'reclamado' ? '⚠️ Este canje ya fue usado' : '⚠️ Este canje fue anulado');
      return;
    }

    const premio = data.premio as any;
    this.canjeValido.set({
      id: data.id,
      premio: premio?.nombre ?? 'Premio',
      tipo: premio?.tipo ?? 'otro',
      valor: Number(premio?.valor ?? 0),
      cantidad: Number(premio?.cantidad ?? 1),
    });
  }

  limpiarCanje(): void {
    this.codigoCanje = '';
    this.canjeValido.set(null);
    this.errorCanje.set(null);
  }

  onDireccionChange(): void {
    if (this.timeoutBusqueda) clearTimeout(this.timeoutBusqueda);
    this.timeoutBusqueda = setTimeout(() => this.buscarEnMapa(), 1000);
  }

  usarMiUbicacion(): void {
    this.errorUbicacion = '';

    if (!window.isSecureContext) {
      this.errorUbicacion = '⚠️ Tu navegador solo permite geolocalización en sitios con https (o localhost).';
      return;
    }

    if (!navigator.geolocation) {
      this.errorUbicacion = 'Tu navegador no soporta geolocalización.';
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
            this.errorUbicacion = '🚫 Permiso denegado. Actívalo en los ajustes del navegador.';
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            this.errorUbicacion = '🌐 No hay señal de ubicación disponible.';
          } else {
            this.errorUbicacion = '⏱️ El GPS tardó demasiado. Intenta de nuevo.';
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
          const comps: { types: string[]; long_name: string }[] = resultado.address_components ?? [];
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
          ].filter(Boolean).join(', ');

          if (direccionCompleta) { this.direccion = direccionCompleta; this.cdr.detectChanges(); return; }
          if (resultado.formatted_address) { this.direccion = resultado.formatted_address; this.cdr.detectChanges(); return; }
        }
      }
    } catch {}

    try {
      const resp = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}&lang=es`);
      if (resp.ok) {
        const p = (await resp.json())?.features?.[0]?.properties;
        if (p) {
          const calle = p.street ? `${p.street}${p.housenumber ? ' #' + p.housenumber : ''}` : p.name || '';
          const direccion = [calle, p.district ? `Barrio ${p.district}` : '', p.city || p.town || p.village, p.state]
            .filter(Boolean).join(', ');
          if (direccion) { this.direccion = direccion; this.cdr.detectChanges(); return; }
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

  enviarPedido(): void {
    this.formularioValido =
      this.nombre.trim() !== '' &&
      this.apellido.trim() !== '' &&
      this.telefono.trim() !== '' &&
      this.direccion.trim() !== '';

    if (!this.formularioValido) return;
    if (!this.carrito.tieneProductosPrincipales()) return;

    this.mostrarModal = true;
  }

  async confirmarEnvio(): Promise<void> {
    if (this.enviandoPedido) return;
    this.enviandoPedido = true;

    const items = this.carrito.itemsSignal();
    const subtotal = this.carrito.totalPedido();
    const descuentoCupon = this.carrito.descuento();
    const descuentoCanje = this.descuentoCanje();
    const descuentoTotal = descuentoCupon + descuentoCanje;
    const domicilio = this.domicilioFinal();
    const total = subtotal - descuentoTotal + domicilio;

    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const hora = ahora.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
    const numeroPedido = `${ahora.getHours().toString().padStart(2, '0')}${ahora.getMinutes().toString().padStart(2, '0')}`;

    const lineasProductos = items
      .map(
        (i, index) =>
          `   ${index + 1}. *${i.cantidad}* x ${i.producto.nombre} ${this.emojiDe(i.producto.nombre)} — _${this.formatearPrecio(i.cantidad * this.precioUnitario(i))}_`,
      )
      .join('\n');

    const lineaSalsasGratis =
      this.valorSalsasGratis() > 0
        ? `   🎁 Salsas gratis (${this.carrito.salsasGratis()}): *-${this.formatearPrecio(this.valorSalsasGratis())}*\n`
        : '';

    const linkMapa =
      this.lat !== null && this.lng !== null
        ? `\n   🗺️ *Ver ubicación en el mapa:* https://www.google.com/maps?q=${this.lat},${this.lng}`
        : '';

    const lineaCupon =
      descuentoCupon > 0
        ? `   🎁 Cupón ${this.carrito.porcentajeCuponTexto()}%: *-${this.formatearPrecio(descuentoCupon)}*\n`
        : '';

    const canje = this.canjeValido();

    const lineaCanjeDescuento =
      descuentoCanje > 0
        ? `   🎟️ Canje ${canje?.premio}: *-${this.formatearPrecio(descuentoCanje)}*\n`
        : '';

    const lineaDomicilioGratis =
      canje?.tipo === 'domicilio' ? `   🛵 *DOMICILIO GRATIS por canje* 🎉\n` : '';

    const lineaCanje = canje
      ? `   🎟️ *CANJE ACTIVO:* ${this.codigoCanje.trim().toUpperCase()}\n      Premio: *${canje.premio}*\n      ⚠️ _Entregar premio al cliente_\n`
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
      (lineaCanje ? `╭─────────────────────╮\n│   🎟️ *CANJE DE PREMIO*\n╰─────────────────────╯\n${lineaCanje}\n` : '') +
      `╭─────────────────────╮\n` +
        `│   💰 *RESUMEN*\n` +
      `╰─────────────────────╯\n` +
      `   🧾 Subtotal: *${this.formatearPrecio(this.subtotalVisible())}*\n` +
      lineaSalsasGratis +
      lineaCupon +
      lineaCanjeDescuento +
      lineaDomicilioGratis +
      `   🛵 Domicilio: *${this.formatearPrecio(domicilio)}*\n` +
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

    if (canje) {
      const { data: reclamado } = await this.supabase.client.rpc('reclamar_canje', {
        p_codigo: this.codigoCanje.trim().toUpperCase(),
      });

      if (!reclamado) {
        this.errorCanje.set('⚠️ Este canje ya fue usado o no está disponible');
        this.canjeValido.set(null);
        this.mostrarModal = false;
        this.enviandoPedido = false;
        return;
      }
    }

    const ok = await this.supabase.registrarPedido({
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
      descuento: descuentoTotal,
      domicilio,
      total,
      lat: this.lat,
      lng: this.lng,
      referido_por: localStorage.getItem('ref-sabrositas'),
      codigo_canje: canje ? this.codigoCanje.trim().toUpperCase() : null,
    });

    if (ok) {
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
      this.codigoCanje = '';
      this.canjeValido.set(null);
      this.canjeAutoAplicado.set(false);
      this.panelAbierto = false;
      this.mostrarModal = false;
    } else {
      if (canje) {
        await this.supabase.client.rpc('liberar_canje', {
          p_codigo: this.codigoCanje.trim().toUpperCase(),
        });
      }
    }

    this.enviandoPedido = false;
  }

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

    // 🥫 Muestra el precio configurado en el admin para salsas; precio real para el resto
  precioUnitario(item: any): number {
    return item.producto.categoria === 'salsa'
      ? this.carrito.precioSalsaExtra()
      : item.producto.precio;
  }

  valorSalsasGratis(): number {
    return this.carrito.salsasGratis() * this.carrito.precioSalsaExtra();
  }

  // Subtotal "visible" con las salsas a su precio real
  subtotalVisible(): number {
    return this.carrito.totalPedido() + this.valorSalsasGratis();
  }
}
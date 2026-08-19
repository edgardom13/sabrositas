import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase';
import { ConfigService } from './config.service';
import { Producto } from './productos.service';

export interface PosItem { producto: Producto; cantidad: number; }
export interface PosCanje { codigo: string; premio: string; tipo: string; valor: number; cantidad: number; }

// 🛵 ID especial (negativo) para identificar el producto virtual "Domicilio"
export const ID_PRODUCTO_DOMICILIO = -999;

// 🖼️ Imagen SVG integrada (no requiere subir archivo)
const DOMICILIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17a2b8"/><stop offset="1" stop-color="#0d5c66"/></linearGradient></defs><rect width="300" height="200" fill="url(#g)"/><text x="150" y="118" font-size="88" text-anchor="middle">🛵</text><text x="150" y="172" font-size="26" fill="#ffffff" text-anchor="middle" font-family="Arial, sans-serif" font-weight="bold">DOMICILIO</text></svg>`;
export const DOMICILIO_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(DOMICILIO_SVG);

@Injectable({ providedIn: 'root' })
export class PosService {
  private supabase = inject(SupabaseService);
  private config = inject(ConfigService);

  items = signal<PosItem[]>([]);
  descuentoManual = signal(0);
  metodoPago = signal('Efectivo');
  tipoEntrega = signal<'local' | 'domicilio'>('local');
  clienteNombre = signal('');
  clienteTelefono = signal('');
  recibido = signal(0);

  // 🎟️ Canje / premio
  codigoCanje = signal('');
  canjeValido = signal<PosCanje | null>(null);
  errorCanje = signal<string | null>(null);
  validandoCanje = signal(false);

  // ===== 🛵 Producto virtual "Domicilio" (precio = valor configurado en Ajustes) =====
  productoDomicilio(): Producto {
    return {
      id: ID_PRODUCTO_DOMICILIO,
      nombre: 'Domicilio',
      precio: Number(this.config.config().domicilio),
      imagen: DOMICILIO_IMG,
      categoria: 'domicilio',
      activo: true,
      orden: 999,
    } as unknown as Producto;
  }

  // 🛵 Si el admin agregó el producto "Domicilio", ese es el cobro manual
  domicilioManual = computed(() => {
    const it = this.items().find((i) => i.producto.id === ID_PRODUCTO_DOMICILIO);
    return it ? it.cantidad * Number(it.producto.precio) : 0;
  });

  // 🛵 Domicilio final = manual (producto) O automático (toggle), nunca ambos
  domicilio = computed(() => {
    const manual = this.domicilioManual();
    if (manual > 0) return manual;
    return this.tipoEntrega() === 'domicilio' ? Number(this.config.config().domicilio) : 0;
  });

  // 💵 Subtotal SIN contar el producto Domicilio (ese va en la línea "Domicilio")
  subtotal = computed(() =>
    this.items()
      .filter((i) => i.producto.id !== ID_PRODUCTO_DOMICILIO)
      .reduce((t, i) => t + i.cantidad * Number(i.producto.precio), 0)
  );

  // ===== 🎟️ Descuento según el tipo de premio =====
  descuentoCanje = computed(() => {
    const c = this.canjeValido();
    if (!c) return 0;
    switch (c.tipo) {
      case 'empanada': {
        const emps = this.items().filter((i) => i.producto.categoria === 'empanada');
        if (!emps.length) return 0;
        const precio = Math.min(...emps.map((i) => Number(i.producto.precio)));
        const enCarrito = emps.reduce((t, i) => t + i.cantidad, 0);
        return precio * Math.min(c.cantidad, enCarrito);
      }
      case 'jugo': {
        const jugos = this.items().filter((i) => i.producto.categoria === 'jugo');
        if (!jugos.length) return 0;
        const precio = Math.min(...jugos.map((i) => Number(i.producto.precio)));
        const enCarrito = jugos.reduce((t, i) => t + i.cantidad, 0);
        return precio * Math.min(c.cantidad, enCarrito);
      }
      case 'domicilio':
        return this.domicilio();
      case 'monto':
        return Number(c.valor);
      default:
        return 0;
    }
  });

  descuentoTotal = computed(() => this.descuentoManual() + this.descuentoCanje());

  total = computed(() =>
    Math.max(0, this.subtotal() - this.descuentoTotal() + this.domicilio())
  );

  cambio = computed(() => {
    if (this.metodoPago() !== 'Efectivo') return 0;
    return Math.max(0, this.recibido() - this.total());
  });

  totalProductos = computed(() => this.items().reduce((t, i) => t + i.cantidad, 0));

  agregar(p: Producto): void {
    this.items.update((items) => {
      const existe = items.find((i) => i.producto.id === p.id);
      if (existe) return items.map((i) => i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...items, { producto: p, cantidad: 1 }];
    });
  }

  restar(id: number): void {
    this.items.update((items) =>
      items.map((i) => i.producto.id === id ? { ...i, cantidad: i.cantidad - 1 } : i).filter((i) => i.cantidad > 0)
    );
  }

  cantidadDe(id: number): number {
    return this.items().find((i) => i.producto.id === id)?.cantidad ?? 0;
  }

  // ===== 🎟️ Validar código de canje =====
  async validarCanje(): Promise<void> {
    const codigo = this.codigoCanje().trim().toUpperCase();
    this.errorCanje.set(null);
    this.canjeValido.set(null);
    if (!codigo) return;

    this.validandoCanje.set(true);
    const { data } = await this.supabase.client
      .from('canjes')
      .select('codigo, estado, premio:premios(nombre, tipo, valor, cantidad)')
      .eq('codigo', codigo)
      .maybeSingle();
    this.validandoCanje.set(false);

    if (!data) { this.errorCanje.set('❌ Código no válido'); return; }
    if (data.estado !== 'pendiente') {
      this.errorCanje.set(data.estado === 'reclamado' ? '⚠️ Este canje ya fue usado' : '⚠️ Canje anulado');
      return;
    }

    const premio = (data as any).premio;
    this.canjeValido.set({
      codigo: (data as any).codigo,
      premio: premio?.nombre ?? 'Premio',
      tipo: premio?.tipo ?? 'otro',
      valor: Number(premio?.valor ?? 0),
      cantidad: Number(premio?.cantidad ?? 1),
    });
  }

  limpiarCanje(): void {
    this.codigoCanje.set('');
    this.canjeValido.set(null);
    this.errorCanje.set(null);
  }

  vaciar(): void {
    this.items.set([]);
    this.descuentoManual.set(0);
    this.recibido.set(0);
    this.clienteNombre.set('');
    this.clienteTelefono.set('');
    this.metodoPago.set('Efectivo');
    this.tipoEntrega.set('local');
    this.limpiarCanje();
  }

  // ===== ✅ Registrar venta =====
  async registrar(): Promise<number | null> {
    if (this.items().length === 0) return null;
    const canje = this.canjeValido();

    if (canje) {
      const { data: reclamado } = await this.supabase.client.rpc('reclamar_canje', { p_codigo: canje.codigo });
      if (!reclamado) {
        this.errorCanje.set('⚠️ Este canje ya fue usado o no está disponible');
        this.canjeValido.set(null);
        return null;
      }
    }

    // 🛵 El producto "Domicilio" NO va en items: se guarda en el campo `domicilio`
    const items = this.items()
      .filter((i) => i.producto.id !== ID_PRODUCTO_DOMICILIO)
      .map((i) => ({
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precio: Number(i.producto.precio),
      }));

    const { data, error } = await this.supabase.client
      .from('pedidos')
      .insert([{
        nombre_cliente: this.clienteNombre().trim() || 'Cliente',
        apellido_cliente: 'Mostrador',
        telefono: this.clienteTelefono().trim() || '0000000000',
        direccion: this.domicilio() > 0 ? ' Domicilio POS' : '🏪 En el local',
        items,
        subtotal: this.subtotal(),
        descuento: this.descuentoTotal(),
        domicilio: this.domicilio(),
        total: this.total(),
        estado: 'entregado',
        pagado: true,
        metodo_pago: this.metodoPago(),
        canal: 'pos',
        codigo_canje: canje ? canje.codigo : null,
      }])
      .select()
      .single();

    if (error) {
      if (canje) await this.supabase.client.rpc('liberar_canje', { p_codigo: canje.codigo });
      console.error('❌ Error POS:', error.message);
      return null;
    }

    this.vaciar();
    return (data as any).id;
  }

  formatearPrecio(v: number): string {
    return '$' + Number(v).toLocaleString('es-CO');
  }
}
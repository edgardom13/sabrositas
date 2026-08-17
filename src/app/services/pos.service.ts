import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase';
import { ConfigService } from './config.service';
import { Producto } from './productos.service';

export interface PosItem { producto: Producto; cantidad: number; }
export interface PosCanje { codigo: string; premio: string; tipo: string; valor: number; cantidad: number; }

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

  domicilio = computed(() =>
    this.tipoEntrega() === 'domicilio' ? Number(this.config.config().domicilio) : 0
  );

  subtotal = computed(() =>
    this.items().reduce((t, i) => t + i.cantidad * Number(i.producto.precio), 0)
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
        return 0; // 'otro' se entrega físico
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

  // ===== ✅ Registrar venta (con canje) =====
  async registrar(): Promise<number | null> {
    if (this.items().length === 0) return null;
    const canje = this.canjeValido();

    // 🔒 Reclamar el canje ANTES de registrar
    if (canje) {
      const { data: reclamado } = await this.supabase.client.rpc('reclamar_canje', { p_codigo: canje.codigo });
      if (!reclamado) {
        this.errorCanje.set('⚠️ Este canje ya fue usado o no está disponible');
        this.canjeValido.set(null);
        return null;
      }
    }

    const items = this.items().map((i) => ({
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
        direccion: this.tipoEntrega() === 'domicilio' ? ' Domicilio POS' : '🏪 En el local',
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
      // ↩️ Si falló, liberar el canje para no perderlo
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
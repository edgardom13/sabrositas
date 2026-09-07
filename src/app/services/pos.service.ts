import { Injectable, inject, signal, computed, effect } from '@angular/core';
import { SupabaseService } from './supabase';
import { ConfigService } from './config.service';
import { Producto, ProductosService } from './productos.service';

export interface PosItem {
  uid: number;
  producto: Producto;
  cantidad: number;
  combo?: ComboDetalle;
}

// 🆕 ComboDetalle flexible: guarda elecciones por cada item del combo
export interface ComboDetalle {
  comboId: number;
  nombre: string;
  precio: number;
  elecciones: { categoria: string; etiqueta: string; nombres: string[] }[];
}

export interface PosCanje { 
  codigo: string; 
  premio: string; 
  tipo: string; 
  valor: number; 
  cantidad: number; 
}

export interface PedidoActivo {
  id: string;
  nombre: string;
  items: PosItem[];
  descuentoManual: number;
  metodoPago: string;
  tipoEntrega: 'local' | 'domicilio';
  clienteNombre: string;
  clienteTelefono: string;
  recibido: number;
  codigoCanje: string;
  canjeValido: PosCanje | null;
  errorCanje: string | null;
  fechaCreacion: number;
}

// 🆕 ComboPos flexible con items
export interface ComboPos {
  id: number;
  nombre: string;
  precio: number;
  items: { categoria: string; cantidad: number; etiqueta: string }[];
  imagen: string;
}

export const ID_PRODUCTO_DOMICILIO = -999;

const DOMICILIO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#17a2b8"/><stop offset="1" stop-color="#0d5c66"/></linearGradient></defs><rect width="300" height="200" fill="url(#g)"/><text x="150" y="118" font-size="88" text-anchor="middle">🛵</text><text x="150" y="172" font-size="26" fill="#ffffff" text-anchor="middle" font-family="Arial" font-weight="bold">DOMICILIO</text></svg>`;
export const DOMICILIO_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(DOMICILIO_SVG);

@Injectable({ providedIn: 'root' })
export class PosService {
  private supabase = inject(SupabaseService);
  private config = inject(ConfigService);
  private productosService = inject(ProductosService);
  private nextUid = Date.now();

  pedidosActivos = signal<PedidoActivo[]>([]);
  pedidoActivoId = signal<string>('');
  private contadorPedidos = 1;

  items = signal<PosItem[]>([]);
  descuentoManual = signal(0);
  metodoPago = signal('Efectivo');
  tipoEntrega = signal<'local' | 'domicilio'>('local');
  clienteNombre = signal('');
  clienteTelefono = signal('');
  recibido = signal(0);
  codigoCanje = signal('');
  canjeValido = signal<PosCanje | null>(null);
  errorCanje = signal<string | null>(null);
  validandoCanje = signal(false);

  // 🆕 Combos desde Supabase (solo los activos en POS)
  combos = computed<ComboPos[]>(() => {
    return this.productosService.combosActivosPos().map(c => ({
      id: c.id,
      nombre: c.nombre,
      precio: Number(c.precio),
      items: c.items || [],
      imagen: c.imagen || this.generarImagenCombo(c.nombre),
    }));
  });

  constructor() {
    this.cargarDeLocalStorage();
    this.productosService.cargarCombos();
    const contadorGuardado = localStorage.getItem('pos_contador_pedidos');
    if (contadorGuardado) this.contadorPedidos = parseInt(contadorGuardado, 10) || 1;

    if (this.pedidosActivos().length === 0) {
      this.crearNuevoPedido();
    } else {
      this.restaurar(this.pedidoActivoId());
    }

    effect(() => {
      this.items(); this.descuentoManual(); this.metodoPago(); this.tipoEntrega();
      this.clienteNombre(); this.clienteTelefono(); this.recibido();
      this.codigoCanje(); this.canjeValido(); this.errorCanje();
      this.snapshotActual();
      this.guardarEnLocalStorage(this.pedidosActivos());
    });
  }

  private generarImagenCombo(nombre: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd54f"/><stop offset="1" stop-color="#ff8f00"/></linearGradient></defs><rect width="300" height="200" fill="url(#g)"/><text x="150" y="112" font-size="80" text-anchor="middle">🎁</text><text x="150" y="170" font-size="24" fill="#5c1010" text-anchor="middle" font-family="Arial" font-weight="bold">${(nombre || '').substring(0, 18)}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  // ===== 🔄 SINCRONIZACIÓN DETERMINISTA =====

  private snapshotActual(): void {
    const id = this.pedidoActivoId();
    this.pedidosActivos.update(list => list.map(p => p.id === id ? {
      ...p,
      items: this.items(),
      descuentoManual: this.descuentoManual(),
      metodoPago: this.metodoPago(),
      tipoEntrega: this.tipoEntrega(),
      clienteNombre: this.clienteNombre(),
      clienteTelefono: this.clienteTelefono(),
      recibido: this.recibido(),
      codigoCanje: this.codigoCanje(),
      canjeValido: this.canjeValido(),
      errorCanje: this.errorCanje(),
    } : p));
  }

  private restaurar(id: string): void {
    const p = this.pedidosActivos().find(x => x.id === id);
    if (!p) return;
    this.items.set(p.items);
    this.descuentoManual.set(p.descuentoManual);
    this.metodoPago.set(p.metodoPago);
    this.tipoEntrega.set(p.tipoEntrega);
    this.clienteNombre.set(p.clienteNombre);
    this.clienteTelefono.set(p.clienteTelefono);
    this.recibido.set(p.recibido);
    this.codigoCanje.set(p.codigoCanje);
    this.canjeValido.set(p.canjeValido);
    this.errorCanje.set(p.errorCanje);
  }

  // ===== 🗂️ GESTIÓN DE TABS =====

  crearNuevoPedido(): string {
    this.snapshotActual();
    const id = `pedido-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const numero = this.contadorPedidos++;
    localStorage.setItem('pos_contador_pedidos', String(this.contadorPedidos));

    const nuevo: PedidoActivo = {
      id, nombre: `Pedido ${numero}`, items: [], descuentoManual: 0,
      metodoPago: 'Efectivo', tipoEntrega: 'local', clienteNombre: '', clienteTelefono: '',
      recibido: 0, codigoCanje: '', canjeValido: null, errorCanje: null, fechaCreacion: Date.now(),
    };

    this.pedidosActivos.update(list => [...list, nuevo]);
    this.pedidoActivoId.set(id);
    this.restaurar(id);
    this.guardarEnLocalStorage(this.pedidosActivos());
    return id;
  }

  cambiarPedido(id: string): void {
    if (id === this.pedidoActivoId()) return;
    this.snapshotActual();
    this.pedidoActivoId.set(id);
    this.restaurar(id);
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  cerrarPedido(id: string): void {
    const pedidos = this.pedidosActivos();
    if (pedidos.length <= 1) {
      this.vaciar();
      return;
    }
    this.snapshotActual();
    const nuevos = pedidos.filter(p => p.id !== id);
    this.pedidosActivos.set(nuevos);
    if (this.pedidoActivoId() === id && nuevos.length > 0) {
      this.pedidoActivoId.set(nuevos[0].id);
      this.restaurar(nuevos[0].id);
    }
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  setNombrePedido(valor: string): void {
    const id = this.pedidoActivoId();
    this.pedidosActivos.update(list => list.map(p => p.id === id ? { ...p, nombre: valor } : p));
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  private guardarEnLocalStorage(pedidos: PedidoActivo[]): void {
    try {
      localStorage.setItem('pos_pedidos_activos', JSON.stringify(pedidos));
      localStorage.setItem('pos_pedido_activo_id', this.pedidoActivoId());
    } catch (e) {
      console.error('Error guardando en localStorage:', e);
    }
  }

  private cargarDeLocalStorage(): void {
    try {
      const data = localStorage.getItem('pos_pedidos_activos');
      const activeId = localStorage.getItem('pos_pedido_activo_id');
      if (data) {
        const pedidos = JSON.parse(data) as PedidoActivo[];
        this.pedidosActivos.set(pedidos);
        if (activeId && pedidos.find(p => p.id === activeId)) {
          this.pedidoActivoId.set(activeId);
        } else if (pedidos.length > 0) {
          this.pedidoActivoId.set(pedidos[0].id);
        }
      }
    } catch (e) {
      console.error('Error cargando de localStorage:', e);
    }
  }

  // ===== 🛒 CARRITO =====

  productoDomicilio(): Producto {
    return {
      id: ID_PRODUCTO_DOMICILIO, nombre: 'Domicilio',
      precio: Number(this.config.config().domicilio),
      imagen: DOMICILIO_IMG, categoria: 'domicilio', activo: true, activo_pos: true, orden: 999, imagen_pos: null,
    } as unknown as Producto;
  }

  domicilioManual = computed(() => {
    const it = this.items().find((i: PosItem) => i.producto.id === ID_PRODUCTO_DOMICILIO);
    return it ? it.cantidad * Number(it.producto.precio) : 0;
  });

  domicilio = computed(() => {
    const manual = this.domicilioManual();
    if (manual > 0) return manual;
    return this.tipoEntrega() === 'domicilio' ? Number(this.config.config().domicilio) : 0;
  });

  subtotal = computed(() =>
    this.items()
      .filter((i: PosItem) => i.producto.id !== ID_PRODUCTO_DOMICILIO)
      .reduce((t: number, i: PosItem) => t + i.cantidad * Number(i.producto.precio), 0)
  );

  imagenParaPos(p: Producto): string {
    return p.imagen_pos || p.imagen;
  }

  descuentoCanje = computed(() => {
    const c = this.canjeValido();
    if (!c) return 0;
    switch (c.tipo) {
      case 'empanada': {
        const emps = this.items().filter((i: PosItem) => i.producto.categoria === 'empanada');
        if (!emps.length) return 0;
        const precio = Math.min(...emps.map((i: PosItem) => Number(i.producto.precio)));
        const enCarrito = emps.reduce((t: number, i: PosItem) => t + i.cantidad, 0);
        return precio * Math.min(c.cantidad, enCarrito);
      }
      case 'jugo': {
        const jugos = this.items().filter((i: PosItem) => i.producto.categoria === 'jugo');
        if (!jugos.length) return 0;
        const precio = Math.min(...jugos.map((i: PosItem) => Number(i.producto.precio)));
        const enCarrito = jugos.reduce((t: number, i: PosItem) => t + i.cantidad, 0);
        return precio * Math.min(c.cantidad, enCarrito);
      }
      case 'domicilio': return this.domicilio();
      case 'monto': return Number(c.valor);
      default: return 0;
    }
  });

  descuentoTotal = computed(() => this.descuentoManual() + this.descuentoCanje());
  total = computed(() => Math.max(0, this.subtotal() - this.descuentoTotal() + this.domicilio()));

  cambio = computed(() => {
    if (this.metodoPago() !== 'Efectivo') return 0;
    return Math.max(0, this.recibido() - this.total());
  });

  totalProductos = computed(() => this.items().reduce((t: number, i: PosItem) => t + i.cantidad, 0));

  agregar(p: Producto): void {
    this.items.update((items) => {
      const existe = items.find((i: PosItem) => i.producto.id === p.id && !i.combo);
      if (existe) return items.map((i: PosItem) => i === existe ? { ...i, cantidad: i.cantidad + 1 } : i);
      return [...items, { uid: this.nextUid++, producto: p, cantidad: 1 }];
    });
    this.snapshotActual();
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  // 🆕 Único agregarCombo: flexible por items
  agregarCombo(combo: ComboPos, elecciones: { categoria: string; etiqueta: string; nombres: string[] }[]): void {
    const virtual: Producto = {
      id: combo.id, nombre: `🎁 ${combo.nombre}`, precio: combo.precio,
      imagen: combo.imagen, categoria: 'empanada', activo: true, activo_pos: true, orden: 0, imagen_pos: null,
    } as unknown as Producto;
    this.items.update((items) => [...items, {
      uid: this.nextUid++,
      producto: virtual,
      cantidad: 1,
      combo: { comboId: combo.id, nombre: combo.nombre, precio: combo.precio, elecciones },
    }]);
    this.snapshotActual();
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  sumarUid(uid: number): void {
    this.items.update((items) => items.map((i: PosItem) => i.uid === uid ? { ...i, cantidad: i.cantidad + 1 } : i));
    this.snapshotActual();
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  restarUid(uid: number): void {
    this.items.update((items) => items.map((i: PosItem) => i.uid === uid ? { ...i, cantidad: i.cantidad - 1 } : i).filter((i: PosItem) => i.cantidad > 0));
    this.snapshotActual();
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  restar(id: number): void {
    const linea = this.items().find((i: PosItem) => i.producto.id === id && !i.combo);
    if (linea) this.restarUid(linea.uid);
  }

  cantidadDe(id: number): number {
    return this.items().filter((i: PosItem) => i.producto.id === id && !i.combo).reduce((t: number, i: PosItem) => t + i.cantidad, 0);
  }

  comboCantidadDe(comboId: number): number {
    return this.items().filter((i: PosItem) => i.combo?.comboId === comboId).reduce((t: number, i: PosItem) => t + i.cantidad, 0);
  }

  async validarCanje(): Promise<void> {
    const codigo = this.codigoCanje().trim().toUpperCase();
    this.errorCanje.set(null);
    this.canjeValido.set(null);
    if (!codigo) return;
    this.validandoCanje.set(true);
    const { data } = await this.supabase.client.from('canjes')
      .select('codigo, estado, premio:premios(nombre, tipo, valor, cantidad)')
      .eq('codigo', codigo).maybeSingle();
    this.validandoCanje.set(false);
    if (!data) { this.errorCanje.set('❌ Código no válido'); return; }
    if (data.estado !== 'pendiente') {
      this.errorCanje.set(data.estado === 'reclamado' ? '⚠️ Este canje ya fue usado' : '⚠️ Canje anulado');
      return;
    }
    const premio = (data as any).premio;
    this.canjeValido.set({
      codigo: (data as any).codigo, premio: premio?.nombre ?? 'Premio',
      tipo: premio?.tipo ?? 'otro', valor: Number(premio?.valor ?? 0), cantidad: Number(premio?.cantidad ?? 1),
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
    this.snapshotActual();
    this.guardarEnLocalStorage(this.pedidosActivos());
  }

  // 💰 COBRAR: registra en Supabase Y cierra el tab
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

    const items: { nombre: string; cantidad: number; precio: number }[] = [];
    for (const i of this.items()) {
      if (i.producto.id === ID_PRODUCTO_DOMICILIO) continue;
      if (i.combo) {
        items.push({ nombre: i.combo.nombre, cantidad: i.cantidad, precio: Number(i.combo.precio) });
        // 🆕 Expandir elecciones flexibles
        for (const ele of i.combo.elecciones) {
          for (const nombre of ele.nombres) {
            items.push({ nombre, cantidad: i.cantidad, precio: 0 });
          }
        }
      } else {
        items.push({ nombre: i.producto.nombre, cantidad: i.cantidad, precio: Number(i.producto.precio) });
      }
    }

    const { data, error } = await this.supabase.client.from('pedidos').insert([{
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
    }]).select().single();

    if (error) {
      if (canje) await this.supabase.client.rpc('liberar_canje', { p_codigo: canje.codigo });
      console.error('❌ Error POS:', error.message);
      return null;
    }
    
    const idActual = this.pedidoActivoId();
    this.cerrarPedido(idActual);
    if (this.pedidosActivos().length === 0) {
      this.crearNuevoPedido();
    }
    
    return (data as any).id;
  }

  formatearPrecio(v: number): string { 
    return '$' + Number(v).toLocaleString('es-CO'); 
  }
}
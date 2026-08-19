import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService, Pedido } from './supabase';

export type Periodo = 'dia' | 'semana' | 'mes' | 'ano' | 'personalizado';

export interface PuntoSerie { etiqueta: string; valor: number; }
export interface TopItem { nombre: string; cantidad: number; ingresos: number; }
export interface TopCliente { nombre: string; telefono: string; pedidos: number; gastado: number; }
export interface Rebanada { etiqueta: string; cantidad: number; color: string; porcentaje: number; }

@Injectable({ providedIn: 'root' })
export class EstadisticasService {
  private supabase = inject(SupabaseService);

  pedidos = signal<Pedido[]>([]);
  egresos = signal<any[]>([]);
  canjes = signal<any[]>([]);
  empleados = signal<any[]>([]);
  pagosEmpleados = signal<any[]>([]);
  inversor = signal<any[]>([]);
  pagosInversor = signal<any[]>([]);
  cargando = signal(false);
  periodo = signal<Periodo>('semana');
  fechaElegida = signal<string>(this.hoyLocal());

  private hoyLocal(): string {
    const d = new Date();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const dia = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  textoFechaElegida = computed(() => {
    const [y, m, d] = this.fechaElegida().split('-').map((n) => Number(n));
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  });

  async cargar(): Promise<void> {
    this.cargando.set(true);

    const [pedidosRes, egresosRes, canjesRes, empleadosRes, pagosEmpRes, invRes, pagosInvRes] = await Promise.all([
      this.supabase.client.from('pedidos').select('*').order('creado_en', { ascending: true }),
      this.supabase.client.from('egresos').select('*').order('fecha', { ascending: false }),
      this.supabase.client.from('canjes').select('*').order('creado_en', { ascending: false }),
      this.supabase.client.from('empleados').select('*'),
      this.supabase.client.from('pagos_empleado').select('*').order('fecha', { ascending: false }),
      this.supabase.client.from('inversor').select('*'),
      this.supabase.client.from('pagos_inversor').select('*').order('fecha', { ascending: false }),
    ]);

    this.cargando.set(false);

    if (pedidosRes.error) console.error('❌ Error pedidos:', pedidosRes.error.message);
    if (egresosRes.error) console.error('❌ Error egresos:', egresosRes.error.message);

    this.pedidos.set((pedidosRes.data as Pedido[]) ?? []);
    this.egresos.set(egresosRes.data ?? []);
    this.canjes.set(canjesRes.data ?? []);
    this.empleados.set(empleadosRes.data ?? []);
    this.pagosEmpleados.set(pagosEmpRes.data ?? []);
    this.inversor.set(invRes.data ?? []);
    this.pagosInversor.set(pagosInvRes.data ?? []);
  }

  private ventaProductos(p: Pedido): number {
    return Number(p.subtotal) - Number(p.descuento);
  }

  private rangos = computed(() => {
    const ahora = new Date();
    const desde = new Date(ahora);
    let hasta = new Date(ahora);
    const antDesde = new Date(ahora);
    const antHasta = new Date(ahora);

    switch (this.periodo()) {
      case 'dia':
        desde.setHours(0, 0, 0, 0);
        antDesde.setDate(antDesde.getDate() - 1); antDesde.setHours(0, 0, 0, 0);
        antHasta.setDate(antHasta.getDate() - 1); antHasta.setHours(23, 59, 59, 999);
        break;
      case 'semana':
        desde.setDate(desde.getDate() - 6); desde.setHours(0, 0, 0, 0);
        antDesde.setDate(antDesde.getDate() - 13); antDesde.setHours(0, 0, 0, 0);
        antHasta.setDate(antHasta.getDate() - 7); antHasta.setHours(23, 59, 59, 999);
        break;
      case 'mes':
        desde.setDate(desde.getDate() - 29); desde.setHours(0, 0, 0, 0);
        antDesde.setDate(antDesde.getDate() - 59); antDesde.setHours(0, 0, 0, 0);
        antHasta.setDate(antHasta.getDate() - 30); antHasta.setHours(23, 59, 59, 999);
        break;
      case 'ano':
        desde.setMonth(0, 1); desde.setHours(0, 0, 0, 0);
        const anioAnt = ahora.getFullYear() - 1;
        antDesde.setFullYear(anioAnt, 0, 1); antDesde.setHours(0, 0, 0, 0);
        antHasta.setFullYear(anioAnt, ahora.getMonth(), ahora.getDate()); antHasta.setHours(23, 59, 59, 999);
        break;
      case 'personalizado': {
        const [y, m, d] = this.fechaElegida().split('-').map((n) => Number(n));
        desde.setFullYear(y, m - 1, d); desde.setHours(0, 0, 0, 0);
        hasta = new Date(y, m - 1, d, 23, 59, 59, 999);
        const previo = new Date(y, m - 1, d - 1);
        antDesde.setTime(previo.getTime()); antDesde.setHours(0, 0, 0, 0);
        antHasta.setTime(previo.getTime()); antHasta.setHours(23, 59, 59, 999);
        break;
      }
    }
    return { desde, hasta, antDesde, antHasta };
  });

  private enRango(fecha: string | Date, desde: Date, hasta: Date): boolean {
    const f = this.parseFecha(fecha);
    return f >= desde && f <= hasta;
  }

  private parseFecha(fecha: string | Date): Date {
    if (fecha instanceof Date) return fecha;
    const s = String(fecha).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map((n) => Number(n));
      return new Date(y, m - 1, d);
    }
    return new Date(s);
  }

  pedidosPeriodo = computed(() => {
    const r = this.rangos();
    return this.pedidos().filter((p) => this.enRango(p.creado_en, r.desde, r.hasta));
  });

  pedidosAnteriores = computed(() => {
    const r = this.rangos();
    return this.pedidos().filter((p) => this.enRango(p.creado_en, r.antDesde, r.antHasta));
  });

  // ================= KPIs =================
  ventas = computed(() =>
    this.pedidosPeriodo().filter((p) => p.estado === 'entregado')
      .reduce((t, p) => t + this.ventaProductos(p), 0)
  );

  // 🛵 Domicilios = ingreso EXTERNO (se paga al domiciliario), no es ganancia propia
  domicilios = computed(() =>
    this.pedidosPeriodo().filter((p) => p.estado === 'entregado')
      .reduce((t, p) => t + Number(p.domicilio), 0)
  );

  // Total recaudado (productos + domicilios) — solo informativo
  ingresosTotales = computed(() => this.ventas() + this.domicilios());

  ventasAnteriores = computed(() =>
    this.pedidosAnteriores().filter((p) => p.estado === 'entregado')
      .reduce((t, p) => t + this.ventaProductos(p), 0)
  );

  crecimiento = computed(() => {
    const ant = this.ventasAnteriores();
    if (ant === 0) return this.ventas() > 0 ? 100 : 0;
    return Math.round(((this.ventas() - ant) / ant) * 100);
  });

  crecimientoAbs = computed(() => Math.abs(this.crecimiento()));

  totalPedidos = computed(() => this.pedidosPeriodo().length);
  entregados = computed(() => this.pedidosPeriodo().filter((p) => p.estado === 'entregado').length);
  enProceso = computed(() => this.pedidosPeriodo().filter((p) => ['pendiente', 'preparando', 'en_camino'].includes(p.estado)).length);
  cancelados = computed(() => this.pedidosPeriodo().filter((p) => p.estado === 'cancelado').length);
  ticketPromedio = computed(() => this.entregados() > 0 ? Math.round(this.ventas() / this.entregados()) : 0);
  clientesUnicos = computed(() => new Set(this.pedidosPeriodo().map((p) => (p.telefono || '').replace(/\D/g, '')).filter(Boolean)).size);
  tasaCancelacion = computed(() => this.totalPedidos() > 0 ? Math.round((this.cancelados() / this.totalPedidos()) * 100) : 0);
  porCobrar = computed(() => this.pedidosPeriodo().filter((p) => p.estado === 'entregado' && !p.pagado).reduce((t, p) => t + Number(p.total), 0));

  // ================= 🆕 EGRESOS =================
  egresosPeriodo = computed(() => {
    const r = this.rangos();
    return this.egresos().filter((e) => this.enRango(e.fecha, r.desde, r.hasta));
  });

  totalEgresos = computed(() => this.egresosPeriodo().reduce((t, e) => t + Number(e.monto), 0));

  // 💎 GANANCIA NETA REAL = ventas de productos − egresos
  // (NO incluye domicilios porque son un ingreso externo)
  gananciaNeta = computed(() => this.ventas() - this.totalEgresos());

  // Referencia: ganancia si contáramos los domicilios (no usar como real)
  gananciaConDomicilios = computed(() => this.ingresosTotales() - this.totalEgresos());

  egresosPorCategoria = computed(() => {
    const mapa = new Map<string, number>();
    for (const e of this.egresosPeriodo()) {
      const cat = e.categoria || 'otro';
      mapa.set(cat, (mapa.get(cat) ?? 0) + Number(e.monto));
    }
    return Array.from(mapa.entries())
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto);
  });

  // ================= 🆕 PROMOCIONES =================
  promosUsadas = computed(() => {
    const mapa = new Map<string, number>();
    for (const p of this.pedidosPeriodo()) {
      if (p.estado !== 'entregado') continue;
      const promo = (p as any).promo_nombre;
      if (promo) mapa.set(promo, (mapa.get(promo) ?? 0) + 1);
    }
    return Array.from(mapa.entries())
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);
  });

  totalPromos = computed(() => this.promosUsadas().reduce((t, p) => t + p.cantidad, 0));

  // ================= 🆕 CANJES =================
  canjesPeriodo = computed(() => {
    const r = this.rangos();
    return this.canjes().filter((c) => this.enRango(c.creado_en, r.desde, r.hasta));
  });

  canjesReclamados = computed(() => this.canjesPeriodo().filter((c) => c.estado === 'reclamado').length);
  canjesPendientes = computed(() => this.canjesPeriodo().filter((c) => c.estado === 'pendiente').length);

  // ================= 🆕 REFERIDOS =================
  pedidosReferidos = computed(() =>
    this.pedidosPeriodo().filter((p) => p.estado === 'entregado' && (p as any).referido_por).length
  );

  // ================= 🆕 EMPLEADOS =================
  totalEmpleados = computed(() => this.empleados().length);

  nominaPeriodo = computed(() => {
    const r = this.rangos();
    return this.pagosEmpleados()
      .filter((p) => this.enRango(p.fecha, r.desde, r.hasta))
      .reduce((t, p) => t + Number(p.monto), 0);
  });

  // ================= 🆕 INVERSOR =================
  pagosInversorPeriodo = computed(() => {
    const r = this.rangos();
    return this.pagosInversor()
      .filter((p) => this.enRango(p.fecha, r.desde, r.hasta))
      .reduce((t, p) => t + Number(p.monto), 0);
  });

  // ================= SERIES Y TOPS =================
  serieVentas = computed<PuntoSerie[]>(() => {
    const entregados = this.pedidosPeriodo().filter((p) => p.estado === 'entregado');
    const puntos: PuntoSerie[] = [];

    if (this.periodo() === 'dia' || this.periodo() === 'personalizado') {
      for (let h = 0; h < 24; h++) puntos.push({ etiqueta: `${h}h`, valor: 0 });
      for (const p of entregados) {
        puntos[new Date(p.creado_en).getHours()].valor += this.ventaProductos(p);
      }
    } else if (this.periodo() === 'semana') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const fin = new Date(d); fin.setHours(23, 59, 59, 999);
        puntos.push({
          etiqueta: d.toLocaleDateString('es-CO', { weekday: 'short' }),
          valor: entregados.filter((p) => { const f = new Date(p.creado_en); return f >= d && f <= fin; })
            .reduce((t, p) => t + this.ventaProductos(p), 0),
        });
      }
    } else if (this.periodo() === 'mes') {
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const fin = new Date(d); fin.setHours(23, 59, 59, 999);
        puntos.push({
          etiqueta: `${d.getDate()}`,
          valor: entregados.filter((p) => { const f = new Date(p.creado_en); return f >= d && f <= fin; })
            .reduce((t, p) => t + this.ventaProductos(p), 0),
        });
      }
    } else {
      const ahora = new Date();
      for (let m = 0; m <= ahora.getMonth(); m++) {
        const ini = new Date(ahora.getFullYear(), m, 1);
        const fin = new Date(ahora.getFullYear(), m + 1, 0, 23, 59, 59, 999);
        puntos.push({
          etiqueta: ini.toLocaleDateString('es-CO', { month: 'short' }),
          valor: entregados.filter((p) => { const f = new Date(p.creado_en); return f >= ini && f <= fin; })
            .reduce((t, p) => t + this.ventaProductos(p), 0),
        });
      }
    }
    return puntos;
  });

  maxSerie = computed(() => Math.max(...this.serieVentas().map((p) => p.valor), 1));

  distribucionEstados = computed<Rebanada[]>(() => {
    const config = [
      { estado: 'pendiente', etiqueta: 'Pendientes', color: '#ffc107' },
      { estado: 'preparando', etiqueta: 'Preparando', color: '#17a2b8' },
      { estado: 'en_camino', etiqueta: 'En camino', color: '#007bff' },
      { estado: 'entregado', etiqueta: 'Entregados', color: '#28a745' },
      { estado: 'cancelado', etiqueta: 'Cancelados', color: '#dc3545' },
    ];
    const total = this.pedidosPeriodo().length;
    if (total === 0) return [];
    return config.map((c) => {
      const cantidad = this.pedidosPeriodo().filter((p) => p.estado === c.estado).length;
      return { ...c, cantidad, porcentaje: (cantidad / total) * 100 };
    }).filter((r) => r.cantidad > 0);
  });

  gradienteDonut = computed(() => {
    const partes = this.distribucionEstados();
    if (partes.length === 0) return 'conic-gradient(#444 0% 100%)';
    let acc = 0;
    const stops = partes.map((p) => {
      const ini = acc; acc += p.porcentaje;
      return `${p.color} ${ini}% ${acc}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  });

  topProductos = computed<TopItem[]>(() => {
    const mapa = new Map<string, TopItem>();
    for (const p of this.pedidosPeriodo()) {
      if (p.estado === 'cancelado') continue;
      for (const item of p.items ?? []) {
        const act = mapa.get(item.nombre) ?? { nombre: item.nombre, cantidad: 0, ingresos: 0 };
        act.cantidad += item.cantidad;
        act.ingresos += item.cantidad * item.precio;
        mapa.set(item.nombre, act);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => b.cantidad - a.cantidad).slice(0, 5);
  });

  maxTopProducto = computed(() => Math.max(...this.topProductos().map((t) => t.cantidad), 1));

  topClientes = computed<TopCliente[]>(() => {
    const mapa = new Map<string, TopCliente>();
    for (const p of this.pedidosPeriodo()) {
      const tel = (p.telefono || '').replace(/\D/g, '');
      if (!tel) continue;
      const act = mapa.get(tel) ?? { nombre: `${p.nombre_cliente} ${p.apellido_cliente}`, telefono: p.telefono, pedidos: 0, gastado: 0 };
      act.pedidos += 1;
      if (p.estado === 'entregado') act.gastado += Number(p.total);
      mapa.set(tel, act);
    }
    return Array.from(mapa.values()).sort((a, b) => b.gastado - a.gastado).slice(0, 5);
  });

  metodosPago = computed(() => {
    const mapa = new Map<string, number>();
    for (const p of this.pedidosPeriodo()) {
      if (!p.pagado) continue;
      const m = p.metodo_pago ?? 'Sin registro';
      mapa.set(m, (mapa.get(m) ?? 0) + 1);
    }
    const total = Array.from(mapa.values()).reduce((a, b) => a + b, 0) || 1;
    return Array.from(mapa.entries())
      .map(([metodo, cantidad]) => ({ metodo, cantidad, porcentaje: Math.round((cantidad / total) * 100) }))
      .sort((a, b) => b.cantidad - a.cantidad);
  });

  mejorMomento = computed(() => {
    const serie = this.serieVentas();
    if (serie.length === 0) return null;
    const max = serie.reduce((a, b) => (b.valor > a.valor ? b : a));
    if (max.valor === 0) return null;
    const textos: Record<Periodo, string> = {
      dia: `la hora de las ${max.etiqueta}`,
      personalizado: `la hora de las ${max.etiqueta}`,
      semana: `el día ${max.etiqueta}`,
      mes: `el día ${max.etiqueta}`,
      ano: `el mes de ${max.etiqueta}`,
    };
    return { texto: textos[this.periodo()], valor: max.valor };
  });

  productoEstrella = computed(() => this.topProductos()[0] ?? null);

  formatearPrecio(valor: number): string {
    return '$' + Number(valor).toLocaleString('es-CO');
  }

  // ================= 🆕 MÉTRICAS DE MARKETING =================
  tasaConversionCanjes = computed(() => {
    const total = this.canjesReclamados() + this.canjesPendientes();
    if (total === 0) return 0;
    return Math.round((this.canjesReclamados() / total) * 100);
  });

  ingresosReferidos = computed(() =>
    this.pedidosPeriodo()
      .filter((p) => p.estado === 'entregado' && (p as any).referido_por)
      .reduce((t, p) => t + Number(p.total), 0)
  );

  porcentajeReferidos = computed(() => {
    const entregados = this.entregados();
    if (entregados === 0) return 0;
    return Math.round((this.pedidosReferidos() / entregados) * 100);
  });
}
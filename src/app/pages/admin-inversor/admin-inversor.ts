import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InversorService, Inversor, ID_DUENO } from '../../services/inversor.service';
import { EstadisticasService } from '../../services/estadisticas.service';

@Component({
  selector: 'app-admin-inversor',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-inversor.html',
  styleUrl: './admin-inversor.css',
})
export class AdminInversor implements OnInit {
  inv = inject(InversorService);
  private stats = inject(EstadisticasService); // 🎯 fuente única de pedidos + egresos completos

  tab = signal<'reparto' | 'dashboard' | 'proyeccion' | 'pagos' | 'editar'>('reparto');
  seleccionadoId = signal<number | null>(null);
  mostrarFormNuevo = signal(false);
  periodoReparto = signal<'hoy' | 'semana' | 'mes' | 'ano'>('semana');

  nuevo = { nombre: '', capital_invertido: 0, porcentaje_ganancias: 0, fecha_inicio: '', notas: '' };
  pagoForm = { monto: 0, concepto: '', fecha: this.hoy(), tipo: 'mensual' };
  editForm = signal({ nombre: '', capital_invertido: 0, porcentaje_ganancias: 0, fecha_inicio: '', notas: '' });

  async ngOnInit() {
    await this.stats.cargar();          // 🎯 carga TODOS los pedidos y TODOS los egresos
    await this.inv.cargarInversores();
    await this.inv.cargarPagos();
    if (this.inv.inversores().length > 0) {
      this.seleccionadoId.set(this.inv.inversores()[0].id);
    }
  }

  seleccionado = computed<Inversor | null>(() =>
    this.inv.inversores().find((i) => i.id === this.seleccionadoId()) ?? null
  );

  seleccionar(id: number): void {
    this.seleccionadoId.set(id);
    if (id === ID_DUENO) this.tab.set('reparto');
    else this.tab.set('dashboard');
  }

  // ===== DATOS DEL SELECCIONADO =====
  pct = computed(() => Number(this.seleccionado()?.porcentaje_ganancias ?? 0) / 100);

  pagosSel = computed(() =>
    this.inv.pagos().filter((p) => p.inversor_id === this.seleccionadoId())
  );

  totalPagadoSel = computed(() => this.pagosSel().reduce((t, p) => t + Number(p.monto), 0));

  pagadoPorTipoSel = computed(() => {
    const r: Record<string, number> = { mensual: 0, adelanto: 0, extra: 0, reintegro: 0 };
    for (const p of this.pagosSel()) r[p.tipo] = (r[p.tipo] ?? 0) + Number(p.monto);
    return r;
  });

  pedidosDelInversor = computed(() => {
    const inicio = this.seleccionado()?.fecha_inicio;
    const desde = inicio ? new Date(inicio + 'T00:00:00').getTime() : 0;
    return this.stats.pedidos().filter(
      (p) => p.estado === 'entregado' && new Date(p.creado_en).getTime() >= desde
    );
  });

  // ===== 🎯 RANGO DE FECHAS (idéntico a Estadísticas) =====
  private parseFecha(fecha: string | Date): Date {
    if (fecha instanceof Date) return fecha;
    const s = String(fecha).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-').map((n) => Number(n));
      return new Date(y, m - 1, d);
    }
    return new Date(s);
  }

  private rangoReparto = computed(() => {
    const ahora = new Date();
    const desde = new Date(ahora);
    switch (this.periodoReparto()) {
      case 'hoy':    desde.setHours(0, 0, 0, 0); break;
      case 'semana': desde.setDate(desde.getDate() - 6);  desde.setHours(0, 0, 0, 0); break;
      case 'mes':    desde.setDate(desde.getDate() - 29); desde.setHours(0, 0, 0, 0); break;
      case 'ano':    desde.setMonth(0, 1); desde.setHours(0, 0, 0, 0); break;
    }
    return { desde, hasta: ahora };
  });

  // ===== 🎯 REPARTO (misma fórmula y datos que Estadísticas) =====
  pedidosPeriodoReparto = computed(() => {
    const r = this.rangoReparto();
    return this.stats.pedidos().filter((p) => {
      if (p.estado !== 'entregado') return false;
      const f = new Date(p.creado_en);
      return f >= r.desde && f <= r.hasta;
    });
  });

  ventasPeriodo = computed(() =>
    this.pedidosPeriodoReparto().reduce((t, p) => t + (Number(p.subtotal) - Number(p.descuento)), 0)
  );

  egresosPeriodo = computed(() => {
    const r = this.rangoReparto();
    return this.stats.egresos()
      .filter((e) => {
        const f = this.parseFecha(e.fecha);
        return f >= r.desde && f <= r.hasta;
      })
      .reduce((t, e) => t + Number(e.monto), 0);
  });

  gananciaNetaPeriodo = computed(() => Math.max(0, this.ventasPeriodo() - this.egresosPeriodo()));

  repartoSocios = computed(() => {
    const ganancia = this.gananciaNetaPeriodo();
    return this.inv.inversores().map((socio) => {
      const pct = Number(socio.porcentaje_ganancias);
      const corresponde = ganancia * (pct / 100);
      const pagado = socio.id === ID_DUENO ? 0 :
        this.inv.pagos().filter((p) => p.inversor_id === socio.id).reduce((t, p) => t + Number(p.monto), 0);
      const pendiente = Math.max(0, corresponde - pagado);
      return { socio, pct, corresponde, pagado, pendiente };
    });
  });

  // ===== 🎯 GANANCIAS DEL SELECCIONADO (datos completos de stats) =====
  gananciaHoySel = computed(() => {
    const hoy = this.hoy();
    const ventas = this.pedidosDelInversor()
      .filter((p) => this.esMismoDia(p.creado_en, hoy))
      .reduce((t, p) => t + (Number(p.subtotal) - Number(p.descuento)), 0);
    const egresos = this.stats.egresos()
      .filter((e) => e.fecha === hoy)
      .reduce((t, e) => t + Number(e.monto), 0);
    return Math.max(0, ventas - egresos) * this.pct();
  });

  gananciaMesSel = computed(() => {
    const ahora = new Date();
    const ventas = this.pedidosDelInversor()
      .filter((p) => {
        const f = new Date(p.creado_en);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      })
      .reduce((t, p) => t + (Number(p.subtotal) - Number(p.descuento)), 0);
    const egresos = this.stats.egresos()
      .filter((e) => {
        const f = this.parseFecha(e.fecha);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      })
      .reduce((t, e) => t + Number(e.monto), 0);
    return Math.max(0, ventas - egresos) * this.pct();
  });

  gananciaAnioSel = computed(() => {
    const anio = new Date().getFullYear();
    const ventas = this.pedidosDelInversor()
      .filter((p) => new Date(p.creado_en).getFullYear() === anio)
      .reduce((t, p) => t + (Number(p.subtotal) - Number(p.descuento)), 0);
    const egresos = this.stats.egresos()
      .filter((e) => this.parseFecha(e.fecha).getFullYear() === anio)
      .reduce((t, e) => t + Number(e.monto), 0);
    return Math.max(0, ventas - egresos) * this.pct();
  });

  roiSel = computed(() => {
    const capital = Number(this.seleccionado()?.capital_invertido ?? 0);
    if (capital <= 0) return 0;
    return (this.totalPagadoSel() / capital) * 100;
  });

  saldoPendienteSel = computed(() =>
    Math.max(0, this.gananciaAnioSel() - this.totalPagadoSel())
  );

  // ===== PROYECCIÓN (días trabajados) =====
  diasTrabajadosTotal = computed(() => {
    const set = new Set<string>();
    for (const p of this.pedidosDelInversor()) set.add(p.creado_en.split('T')[0]);
    return set.size;
  });

  diasTrabajadosMes = computed(() => {
    const set = new Set<string>();
    const limite = 30 * 24 * 60 * 60 * 1000;
    const ahora = Date.now();
    for (const p of this.pedidosDelInversor()) {
      if (ahora - new Date(p.creado_en).getTime() <= limite) set.add(p.creado_en.split('T')[0]);
    }
    return set.size;
  });

  recogidoTotal = computed(() =>
    this.pedidosDelInversor().reduce((t, p) => t + (Number(p.subtotal) - Number(p.descuento)), 0)
  );

  promedioDiaTrabajado = computed(() => {
    const dias = this.diasTrabajadosTotal();
    if (dias === 0) return 0;
    return this.recogidoTotal() / dias;
  });

  proyeccionMensualSel = computed(() =>
    this.promedioDiaTrabajado() * this.diasTrabajadosMes() * 0.7 * this.pct()
  );

  gananciaPorDiaTrabajado = computed(() =>
    this.promedioDiaTrabajado() * 0.7 * this.pct()
  );

  mesesParaRecuperarSel = computed(() => {
    const capital = Number(this.seleccionado()?.capital_invertido ?? 0);
    const mensual = this.proyeccionMensualSel();
    if (mensual <= 0) return '∞';
    return Math.ceil(capital / mensual).toString();
  });

  // ===== ACCIONES CRUD =====
  async crearInversor() {
    if (!this.nuevo.nombre.trim()) return;
    const id = await this.inv.crear({
      nombre: this.nuevo.nombre.trim(),
      capital_invertido: this.nuevo.capital_invertido,
      porcentaje_ganancias: this.nuevo.porcentaje_ganancias,
      fecha_inicio: this.nuevo.fecha_inicio || null,
      notas: this.nuevo.notas || null,
    });
    if (id) {
      this.seleccionadoId.set(id);
      this.mostrarFormNuevo.set(false);
      this.nuevo = { nombre: '', capital_invertido: 0, porcentaje_ganancias: 0, fecha_inicio: '', notas: '' };
    }
  }

  abrirEdicion() {
    const sel = this.seleccionado();
    if (!sel) return;
    this.editForm.set({
      nombre: sel.nombre,
      capital_invertido: Number(sel.capital_invertido) || 0,
      porcentaje_ganancias: Number(sel.porcentaje_ganancias) || 0,
      fecha_inicio: sel.fecha_inicio ?? '',
      notas: sel.notas ?? '',
    });
    this.tab.set('editar');
  }

  async guardarEdicion() {
    const sel = this.seleccionado();
    if (!sel || !this.editForm().nombre.trim()) return;
    await this.inv.actualizar(sel.id, this.editForm());
    this.tab.set('dashboard');
  }

  async eliminarInversor(id: number) {
    if (!confirm('¿Eliminar este inversor? Sus pagos quedarán sin asignar.')) return;
    await this.inv.eliminar(id);
    if (this.seleccionadoId() === id) {
      this.seleccionadoId.set(this.inv.inversores()[0]?.id ?? null);
    }
  }

  async registrarPago() {
    const sel = this.seleccionado();
    if (!sel || this.pagoForm.monto <= 0 || !this.pagoForm.concepto.trim()) return;
    const ok = await this.inv.registrarPago({ ...this.pagoForm, inversor_id: sel.id });
    if (ok) {
      this.pagoForm = { monto: 0, concepto: '', fecha: this.hoy(), tipo: 'mensual' };
    }
  }

  async eliminarPago(id: number) {
    if (!confirm('¿Eliminar este pago?')) return;
    await this.inv.eliminarPago(id);
  }

  // ===== UTILIDADES =====
  formatearPrecio(v: number): string {
    return '$' + Number(v).toLocaleString('es-CO');
  }

  emojiTipo(t: string): string {
    return t === 'mensual' ? '📅' : t === 'adelanto' ? '⏩' : t === 'extra' ? '✨' : '🔄';
  }

  private hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private esMismoDia(iso: string, fecha: string): boolean {
    const f = new Date(iso);
    const [y, m, d] = fecha.split('-').map((n) => Number(n));
    return f.getFullYear() === y && f.getMonth() + 1 === m && f.getDate() === d;
  }
}
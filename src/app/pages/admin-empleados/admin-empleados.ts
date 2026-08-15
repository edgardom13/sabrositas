import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EmpleadosService, Empleado } from '../../services/empleados.service';
import { PedidosService } from '../../services/pedidos.service';

interface EmpleadoForm {
  nombre: string;
  cargo: string;
  tipo_pago: 'diario' | 'mensual';
  salario: number;
  fecha_inicio: string;
  notas: string;
}

@Component({
  selector: 'app-admin-empleados',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-empleados.html',
  styleUrl: './admin-empleados.css',
})
export class AdminEmpleados implements OnInit {
  emp = inject(EmpleadosService);
  pedidos = inject(PedidosService);

  tab = signal<'dashboard' | 'pagos' | 'editar'>('dashboard');
  seleccionadoId = signal<number | null>(null);
  mostrarFormNuevo = signal(false);

  nuevo: EmpleadoForm = { nombre: '', cargo: '', tipo_pago: 'mensual', salario: 0, fecha_inicio: '', notas: '' };
  pagoForm = { monto: 0, concepto: '', fecha: this.hoy(), tipo: 'mensual' };
  editForm = signal<EmpleadoForm>({ nombre: '', cargo: '', tipo_pago: 'mensual', salario: 0, fecha_inicio: '', notas: '' });

  async ngOnInit() {
    await this.pedidos.cargarPedidos();
    await this.emp.cargarEmpleados();
    await this.emp.cargarPagos();
    if (this.emp.empleados().length > 0) {
      this.seleccionadoId.set(this.emp.empleados()[0].id);
    }
  }

  // ===== SELECCIÓN =====
  seleccionado = computed<Empleado | null>(() =>
    this.emp.empleados().find((e) => e.id === this.seleccionadoId()) ?? null
  );

  seleccionar(id: number): void {
    this.seleccionadoId.set(id);
    this.tab.set('dashboard');
  }

  // ===== DÍAS TRABAJADOS (mes actual, para pago diario) =====
  diasTrabajadosMes = computed(() => {
    const set = new Set<string>();
    const ahora = new Date();
    for (const p of this.pedidos.pedidos()) {
      if (p.estado !== 'entregado') continue;
      const f = new Date(p.creado_en);
      if (f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear()) {
        set.add(p.creado_en.split('T')[0]);
      }
    }
    return set.size;
  });

  // ===== DEVENGADO (lo que se le debe este mes) =====
  devengadoDe = (e: Empleado): number => {
    const salario = Number(e.salario) || 0;
    return e.tipo_pago === 'diario' ? salario * this.diasTrabajadosMes() : salario;
  };

  devengadoMesSel = computed(() => {
    const e = this.seleccionado();
    return e ? this.devengadoDe(e) : 0;
  });

  // ===== PAGOS =====
  pagosSel = computed(() =>
    this.emp.pagos().filter((p) => p.empleado_id === this.seleccionadoId())
  );

  totalPagadoSel = computed(() => this.pagosSel().reduce((t, p) => t + Number(p.monto), 0));

  pagadoMesSel = computed(() => {
    const ahora = new Date();
    return this.pagosSel()
      .filter((p) => {
        const f = new Date(p.fecha);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      })
      .reduce((t, p) => t + Number(p.monto), 0);
  });

  saldoMesSel = computed(() => Math.max(0, this.devengadoMesSel() - this.pagadoMesSel()));

  pagadoPorTipoSel = computed(() => {
    const r: Record<string, number> = { mensual: 0, adelanto: 0, bono: 0, otro: 0 };
    for (const p of this.pagosSel()) r[p.tipo] = (r[p.tipo] ?? 0) + Number(p.monto);
    return r;
  });

  // ===== STATS GLOBALES =====
  nominaMes = computed(() =>
    this.emp.empleados().reduce((t, e) => t + this.devengadoDe(e), 0)
  );

  pagadoMesTotal = computed(() => {
    const ahora = new Date();
    return this.emp.pagos()
      .filter((p) => {
        const f = new Date(p.fecha);
        return f.getMonth() === ahora.getMonth() && f.getFullYear() === ahora.getFullYear();
      })
      .reduce((t, p) => t + Number(p.monto), 0);
  });

  // ===== ACCIONES =====
  async crearEmpleado() {
    if (!this.nuevo.nombre.trim()) return;
    const id = await this.emp.crear({
      nombre: this.nuevo.nombre.trim(),
      cargo: this.nuevo.cargo.trim(),
      tipo_pago: this.nuevo.tipo_pago,
      salario: this.nuevo.salario,
      fecha_inicio: this.nuevo.fecha_inicio || null,
      notas: this.nuevo.notas || null,
    });
    if (id) {
      this.seleccionadoId.set(id);
      this.mostrarFormNuevo.set(false);
      this.nuevo = { nombre: '', cargo: '', tipo_pago: 'mensual', salario: 0, fecha_inicio: '', notas: '' };
    }
  }

  abrirEdicion() {
    const sel = this.seleccionado();
    if (!sel) return;
    this.editForm.set({
      nombre: sel.nombre,
      cargo: sel.cargo,
      tipo_pago: sel.tipo_pago,
      salario: Number(sel.salario) || 0,
      fecha_inicio: sel.fecha_inicio ?? '',
      notas: sel.notas ?? '',
    });
    this.tab.set('editar');
  }

  async guardarEdicion() {
    const sel = this.seleccionado();
    if (!sel || !this.editForm().nombre.trim()) return;
    await this.emp.actualizar(sel.id, this.editForm());
    this.tab.set('dashboard');
  }

  async eliminarEmpleado(id: number) {
    if (!confirm('¿Eliminar este empleado? Sus pagos quedarán sin asignar.')) return;
    await this.emp.eliminar(id);
    if (this.seleccionadoId() === id) {
      this.seleccionadoId.set(this.emp.empleados()[0]?.id ?? null);
    }
  }

  async registrarPago() {
    const sel = this.seleccionado();
    if (!sel || this.pagoForm.monto <= 0 || !this.pagoForm.concepto.trim()) return;
    const ok = await this.emp.registrarPago({ ...this.pagoForm, empleado_id: sel.id });
    if (ok) {
      this.pagoForm = { monto: 0, concepto: '', fecha: this.hoy(), tipo: 'mensual' };
    }
  }

  async eliminarPago(id: number) {
    if (!confirm('¿Eliminar este pago?')) return;
    await this.emp.eliminarPago(id);
  }

  // ===== UTILIDADES =====
  formatearPrecio(v: number): string {
    return '$' + Number(v).toLocaleString('es-CO');
  }

  emojiTipo(t: string): string {
    return t === 'mensual' ? '📅' : t === 'adelanto' ? '⏩' : t === 'bono' ? '🎁' : '📦';
  }

  tipoPagoTexto(t: string): string {
    return t === 'diario' ? 'Por día' : 'Mensual';
  }

  private hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
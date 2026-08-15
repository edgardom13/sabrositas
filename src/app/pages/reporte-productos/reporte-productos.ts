import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { PedidosService } from '../../services/pedidos.service';

interface ProductoEntregado {
  nombre: string;
  cantidad: number;
  ingreso: number;
  categoria: string;
}

@Component({
  selector: 'app-reporte-productos',
  standalone: true,
  imports: [],
  templateUrl: './reporte-productos.html',
  styleUrl: './reporte-productos.css',
})
export class ReporteProductos implements OnInit {
  pedidosService = inject(PedidosService);

  fechaSeleccionada = signal<string>(this.hoyLocal());
  verHistorico = signal(false);

  filtros: { valor: 'hoy' | 'semana' | 'mes' | 'todo'; etiqueta: string }[] = [
    { valor: 'hoy', etiqueta: '📅 Hoy' },
    { valor: 'semana', etiqueta: '📆 Últimos 7 días' },
    { valor: 'mes', etiqueta: '🗓️ Últimos 30 días' },
    { valor: 'todo', etiqueta: '🗂️ Histórico' },
  ];

  rango = signal<'hoy' | 'semana' | 'mes' | 'todo'>('hoy');

  ngOnInit(): void {
    this.pedidosService.cargarPedidos();
  }

  // 📦 Pedidos entregados en el rango seleccionado
  pedidosEntregados = computed(() => {
    const todos = this.pedidosService.pedidos().filter((p) => p.estado === 'entregado');
    const ahora = Date.now();
    const dias7 = 7 * 24 * 60 * 60 * 1000;
    const dias30 = 30 * 24 * 60 * 60 * 1000;

    switch (this.rango()) {
      case 'hoy': {
        const hoy = this.fechaSeleccionada();
        return todos.filter((p) => this.esMismoDia(p.creado_en, hoy));
      }
      case 'semana':
        return todos.filter((p) => ahora - new Date(p.creado_en).getTime() <= dias7);
      case 'mes':
        return todos.filter((p) => ahora - new Date(p.creado_en).getTime() <= dias30);
      default:
        return todos;
    }
  });

  // 📊 Totales
  totalUnidades = computed(() => {
    let t = 0;
    for (const p of this.pedidosEntregados()) {
      for (const i of (p.items as any[]) || []) {
        t += Number(i.cantidad) || 0;
      }
    }
    return t;
  });

  totalIngresos = computed(() => {
    return this.pedidosEntregados().reduce((t, p) => t + Number(p.total), 0);
  });

  totalPedidos = computed(() => this.pedidosEntregados().length);

  // 🥇 Ranking de productos
  ranking = computed<ProductoEntregado[]>(() => {
    const mapa = new Map<string, ProductoEntregado>();

    for (const p of this.pedidosEntregados()) {
      for (const i of (p.items as any[]) || []) {
        const nombre = i.nombre;
        const cantidad = Number(i.cantidad) || 0;
        const precio = Number(i.precio) || 0;
        const ingreso = cantidad * precio;
        const categoria = this.detectarCategoria(nombre);

        const actual = mapa.get(nombre);
        if (actual) {
          actual.cantidad += cantidad;
          actual.ingreso += ingreso;
        } else {
          mapa.set(nombre, { nombre, cantidad, ingreso, categoria });
        }
      }
    }

    return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
  });

  // 🏆 Top 1 (el más vendido)
  productoTop = computed(() => this.ranking()[0]?.nombre ?? '—');

  // 📈 Máxima cantidad (para las barras de progreso)
  maxCantidad = computed(() => this.ranking()[0]?.cantidad ?? 1);

  // 🎯 Filtro por categoría
  filtroCategoria = signal<'todos' | 'empanada' | 'jugo' | 'frio' | 'salsa'>('todos');

  rankingFiltrado = computed(() => {
    const cat = this.filtroCategoria();
    if (cat === 'todos') return this.ranking();
    return this.ranking().filter((p) => p.categoria === cat);
  });

  conteoCategoria(cat: 'todos' | 'empanada' | 'jugo' | 'frio' | 'salsa'): number {
    if (cat === 'todos') return this.ranking().length;
    return this.ranking().filter((p) => p.categoria === cat).length;
  }

  categorias: { valor: 'todos' | 'empanada' | 'jugo' | 'frio' | 'salsa'; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: '🌐 Todos' },
    { valor: 'empanada', etiqueta: '🥟 Empanadas' },
    { valor: 'jugo', etiqueta: '🍹 Jugos' },
    { valor: 'frio', etiqueta: '🧊 Fríos' },
    { valor: 'salsa', etiqueta: '🥫 Salsas' },
  ];

  emojiCategoria(cat: string): string {
    return cat === 'empanada' ? '🥟' : cat === 'jugo' ? '🍹' : cat === 'frio' ? '🧊' : cat === 'salsa' ? '🥫' : '📦';
  }

  medalla(index: number): string {
    return index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
  }

  porcentajeBarra(cantidad: number): number {
    const max = this.maxCantidad();
    return max > 0 ? (cantidad / max) * 100 : 0;
  }

  cambiarRango(r: 'hoy' | 'semana' | 'mes' | 'todo'): void {
    this.rango.set(r);
    if (r === 'hoy') this.fechaSeleccionada.set(this.hoyLocal());
  }

  cambiarFecha(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) {
      this.fechaSeleccionada.set(valor);
      this.rango.set('hoy');
    }
  }

  irAHoy(): void {
    this.fechaSeleccionada.set(this.hoyLocal());
    this.rango.set('hoy');
  }

  textoFecha = computed(() => {
    const [y, m, d] = this.fechaSeleccionada().split('-').map((n) => Number(n));
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  });

  formatearPrecio(v: number): string {
    return '$' + v.toLocaleString('es-CO');
  }

  private hoyLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private esMismoDia(iso: string, fecha: string): boolean {
    const f = new Date(iso);
    const [y, m, d] = fecha.split('-').map((n) => Number(n));
    return f.getFullYear() === y && f.getMonth() + 1 === m && f.getDate() === d;
  }

  private detectarCategoria(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('salsa') || n.includes('suero') || n.includes('ají')) return 'salsa';
    if (n.includes('jugo') || n.includes('limonada') || n.includes('agua') || n.includes('maíz') || n.includes('maiz') || n.includes('corozo') || n.includes('zapote')) return 'jugo';
    if (n.includes('gaseosa') || n.includes('coca') || n.includes('kola') || n.includes('cerveza') || n.includes('malta')) return 'frio';
    return 'empanada';
  }
}
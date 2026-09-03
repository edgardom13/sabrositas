import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { PedidosService } from '../../services/pedidos.service';
import { ProductosService } from '../../services/productos.service';

interface ProductoEntregado {
  nombre: string;
  cantidad: number;
  ingreso: number;
  categoria: string;
}

// 💲 Valor referencial de un jugo cuando se vende DENTRO de un combo
const PRECIO_JUGO_COMBO = 1000;

@Component({
  selector: 'app-reporte-productos',
  standalone: true,
  imports: [],
  templateUrl: './reporte-productos.html',
  styleUrl: './reporte-productos.css',
})
export class ReporteProductos implements OnInit {
  pedidosService = inject(PedidosService);
  productos = inject(ProductosService);

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
    this.productos.cargar();
  }

  // 🗺️ Mapa: nombre normalizado → { nombre oficial, categoría, precio } del catálogo
  private canonMap = computed(() => {
    const map = new Map<string, { nombre: string; categoria: string; precio: number }>();
    for (const p of this.productos.productos()) {
      map.set(this.normalizar(p.nombre), { nombre: p.nombre, categoria: p.categoria, precio: Number(p.precio) || 0 });
    }
    return map;
  });

  private normalizar(nombre: string): string {
    return (nombre || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .split(/\s+/)
      .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w))
      .join(' ');
  }

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

  totalUnidades = computed(() => {
    let t = 0;
    for (const p of this.pedidosEntregados()) {
      for (const i of (p.items as any[]) || []) {
        if (this.esLineaDeCombo(i)) continue;
        t += Number(i.cantidad) || 0;
      }
    }
    return t;
  });

  totalIngresos = computed(() =>
    this.pedidosEntregados().reduce((t, p) => t + Number(p.total), 0),
  );

  totalPedidos = computed(() => this.pedidosEntregados().length);

  // 🥇 Ranking SIN duplicados + valor referencial para productos de combo
  ranking = computed<ProductoEntregado[]>(() => {
    const mapa = new Map<string, ProductoEntregado>();

    for (const p of this.pedidosEntregados()) {
      for (const i of (p.items as any[]) || []) {
        if (this.esLineaDeCombo(i)) continue;

        const nombreOriginal = i.nombre;
        const clave = this.normalizar(nombreOriginal);
        const canon = this.canonMap().get(clave);

        const nombre = canon?.nombre ?? nombreOriginal;
        const categoria = canon?.categoria ?? this.detectarCategoria(nombreOriginal);
        const precioCatalogo = canon?.precio ?? 0;

        const cantidad = Number(i.cantidad) || 0;
        const precioReal = Number(i.precio) || 0;

        // 💡 Si viene de combo (precio 0), usa valor referencial:
        //    jugo → $1.000 · demás → precio de catálogo
        const precioUnitario = precioReal > 0
          ? precioReal
          : (categoria === 'jugo' ? PRECIO_JUGO_COMBO : precioCatalogo);

        const ingreso = cantidad * precioUnitario;

        const actual = mapa.get(clave);
        if (actual) {
          actual.cantidad += cantidad;
          actual.ingreso += ingreso;
        } else {
          mapa.set(clave, { nombre, cantidad, ingreso, categoria });
        }
      }
    }

    return [...mapa.values()].sort((a, b) => b.cantidad - a.cantidad);
  });

  productoTop = computed(() => this.ranking()[0]?.nombre ?? '—');
  maxCantidad = computed(() => this.ranking()[0]?.cantidad ?? 1);

  filtroCategoria = signal<'todos' | 'empanada' | 'jugo' | 'frio' | 'salsa' | 'arroz' | 'asadura' | 'plastico' | 'papa'>('todos');

  rankingFiltrado = computed(() => {
    const cat = this.filtroCategoria();
    if (cat === 'todos') return this.ranking();
    return this.ranking().filter((p) => p.categoria === cat);
  });

  conteoCategoria(cat: 'todos' | 'empanada' | 'jugo' | 'frio' | 'salsa' | 'arroz' | 'asadura' | 'plastico' | 'papa'): number {
    if (cat === 'todos') return this.ranking().length;
    return this.ranking().filter((p) => p.categoria === cat).length;
  }

  categorias: { valor: 'todos' | 'empanada' | 'jugo' | 'frio' | 'salsa' | 'arroz' | 'asadura' | 'plastico' | 'papa'; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: '🌐 Todos' },
    { valor: 'empanada', etiqueta: '🥟 Empanadas' },
    { valor: 'jugo', etiqueta: '🍹 Jugos' },
    { valor: 'frio', etiqueta: '🧊 Fríos' },
    { valor: 'salsa', etiqueta: '🥫 Salsas' },
    { valor: 'arroz', etiqueta: '🍚 Arroces' },
    { valor: 'asadura', etiqueta: '🥩 Asaduras' },
    { valor: 'plastico', etiqueta: '🛍️ Plásticos' },
    { valor: 'papa', etiqueta: '🥔 Papas' },
  ];

  emojiCategoria(cat: string): string {
    const emojis: Record<string, string> = {
      empanada: '🥟', jugo: '🍹', frio: '🧊', salsa: '🥫',
      arroz: '🍚', asadura: '🥩', plastico: '🛍️', papa: '🥔',
    };
    return emojis[cat] ?? '📦';
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

  private esLineaDeCombo(item: any): boolean {
    const nombre = (item.nombre || '').toLowerCase();
    const precio = Number(item.precio) || 0;
    return precio > 0 && (nombre.includes('combo') || nombre.startsWith('🎁'));
  }

  private detectarCategoria(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('salsa') || n.includes('suero') || n.includes('ají') || n.includes('aji')) return 'salsa';
    if (n.includes('jugo') || n.includes('limonada') || n.includes('agua') || n.includes('maíz') || n.includes('maiz') || n.includes('corozo') || n.includes('zapote') || n.includes('mango') || n.includes('guanábana') || n.includes('guanabana') || n.includes('maracuyá') || n.includes('maracuya') || n.includes('tamarindo')) return 'jugo';
    if (n.includes('gaseosa') || n.includes('coca') || n.includes('kola') || n.includes('cerveza') || n.includes('malta') || n.includes('pony') || n.includes('sprite') || n.includes('fanta')) return 'frio';
    if (n.includes('arroz') || n.includes('cerdo')) return 'arroz';
    if (n.includes('asadura') || n.includes('yuca')) return 'asadura';
    if (n.includes('plástico') || n.includes('plastico') || n.includes('bolsa') || n.includes('envase') || n.includes('contenedor')) return 'plastico';
    if (n.includes('papa') || n.includes('patata')) return 'papa';
    return 'empanada';
  }
}
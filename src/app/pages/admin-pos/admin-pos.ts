import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../services/pos.service';
import { ProductosService, Producto } from '../../services/productos.service';

type Cat = 'todos' | 'empanada' | 'jugo' | 'frio' | 'salsa';

@Component({
  selector: 'app-admin-pos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-pos.html',
  styleUrl: './admin-pos.css',
})
export class AdminPos implements OnInit {
  pos = inject(PosService);
  productos = inject(ProductosService);

  filtroCat = signal<Cat>('todos');
  busqueda = signal('');
  toast = signal<string | null>(null);
  registrando = signal(false);

  panelAbierto = signal(false);

  abrirPanel(): void { this.panelAbierto.set(true); }
  cerrarPanel(): void { this.panelAbierto.set(false); }

  categorias: { valor: Cat; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: '🌐 Todo' },
    { valor: 'empanada', etiqueta: '🥟 Empanadas' },
    { valor: 'jugo', etiqueta: '🍹 Jugos' },
    { valor: 'frio', etiqueta: '🧊 Fríos' },
    { valor: 'salsa', etiqueta: '🥫 Salsas' },
  ];

  // 🥟🍹🥫 Orden fijo de categorías
  private ordenCat: Record<string, number> = {
    empanada: 0,
    jugo: 1,
    frio: 2,
    salsa: 3,
  };

  private ordenDe(p: Producto): number {
    return (p as any).orden ?? 0;
  }

  async ngOnInit(): Promise<void> {
    await this.productos.cargar();
  }

  // ===== Lista filtrada, buscada y ORDENADA por categoría =====
  lista = computed(() => {
    let l = this.productos.catalogo().filter((p) => p.activo);
    if (this.filtroCat() !== 'todos') l = l.filter((p) => p.categoria === this.filtroCat());
    const q = this.busqueda().trim().toLowerCase();
    if (q) l = l.filter((p) => p.nombre.toLowerCase().includes(q));

    return [...l].sort((a, b) => {
      const ca = this.ordenCat[a.categoria] ?? 99;
      const cb = this.ordenCat[b.categoria] ?? 99;
      if (ca !== cb) return ca - cb;                       // 1️⃣ categoría
      if (this.ordenDe(a) !== this.ordenDe(b)) {
        return this.ordenDe(a) - this.ordenDe(b);          // 2️⃣ orden interno
      }
      return a.nombre.localeCompare(b.nombre);             // 3️⃣ nombre
    });
  });

  async registrarVenta(): Promise<void> {
    if (this.pos.items().length === 0) return;
    this.registrando.set(true);
    const id = await this.pos.registrar();
    this.registrando.set(false);

    if (id) {
      this.mostrarToast(`✅ Venta #${id} registrada (${this.pos.metodoPago()})`);
    } else {
      this.mostrarToast('❌ Error al registrar la venta');
    }
  }

  private mostrarToast(t: string): void {
    this.toast.set(t);
    setTimeout(() => this.toast.set(null), 3000);
  }
}
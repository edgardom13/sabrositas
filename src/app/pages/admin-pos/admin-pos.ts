import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PosService } from '../../services/pos.service';
import { ProductosService } from '../../services/productos.service';

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

  async ngOnInit(): Promise<void> {
    await this.productos.cargar();
  }

  lista = computed(() => {
    let l = this.productos.catalogo().filter((p) => p.activo);
    if (this.filtroCat() !== 'todos') l = l.filter((p) => p.categoria === this.filtroCat());
    const q = this.busqueda().trim().toLowerCase();
    if (q) l = l.filter((p) => p.nombre.toLowerCase().includes(q));
    return l;
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
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PosService, ComboPos } from '../../services/pos.service';
import { ProductosService, Producto } from '../../services/productos.service';

type Cat = 'todos' | 'combos' | 'empanada' | 'jugo' | 'frio' | 'salsa' | 'domicilio';

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

  // 🎁 Modal de combo
  comboModal = signal<ComboPos | null>(null);
  jugosElegidos = signal<string[]>([]);

  abrirPanel(): void { this.panelAbierto.set(true); }
  cerrarPanel(): void { this.panelAbierto.set(false); }

  categorias: { valor: Cat; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: '🌐 Todo' },
    { valor: 'combos', etiqueta: '🎁 Combos' },
    { valor: 'empanada', etiqueta: '🥟 Empanadas' },
    { valor: 'jugo', etiqueta: '🍹 Jugos' },
    { valor: 'frio', etiqueta: '🧊 Fríos' },
    { valor: 'salsa', etiqueta: '🥫 Salsas' },
    { valor: 'domicilio', etiqueta: '🛵 Domicilio' },
  ];

  private ordenCat: Record<string, number> = { empanada: 0, jugo: 1, frio: 2, salsa: 3, domicilio: 4 };
  private ordenDe(p: Producto): number { return (p as any).orden ?? 0; }

  async ngOnInit(): Promise<void> { await this.productos.cargar(); }

  lista = computed(() => {
    const todos = [...this.productos.catalogo().filter((p) => p.activo), this.pos.productoDomicilio()];
    let l = todos;
    if (this.filtroCat() !== 'todos' && this.filtroCat() !== 'combos') l = l.filter((p) => p.categoria === this.filtroCat());
    const q = this.busqueda().trim().toLowerCase();
    if (q) l = l.filter((p) => p.nombre.toLowerCase().includes(q));
    return [...l].sort((a, b) => {
      const ca = this.ordenCat[a.categoria] ?? 99;
      const cb = this.ordenCat[b.categoria] ?? 99;
      if (ca !== cb) return ca - cb;
      if (this.ordenDe(a) !== this.ordenDe(b)) return this.ordenDe(a) - this.ordenDe(b);
      return a.nombre.localeCompare(b.nombre);
    });
  });

  // 🎁 Combos visibles
  combosLista = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    let l = this.pos.combos();
    if (q) l = l.filter((c) => c.nombre.toLowerCase().includes(q));
    return l;
  });

  resumenCombo(c: ComboPos): string {
    const emp = c.empanadas.reduce((t, e) => t + e.cantidad, 0);
    return `${emp} 🥟 + ${c.jugos} 🍹`;
  }

  // ===== 🎁 MODAL DE COMBO =====
  abrirComboModal(c: ComboPos): void { this.jugosElegidos.set([]); this.comboModal.set(c); }
  cancelarCombo(): void { this.comboModal.set(null); this.jugosElegidos.set([]); }

  elegirJugo(nombre: string): void {
    const combo = this.comboModal();
    if (!combo) return;
    if (this.jugosElegidos().length < combo.jugos) this.jugosElegidos.update((l) => [...l, nombre]);
  }

  quitarJugo(index: number): void {
    this.jugosElegidos.update((l) => l.filter((_, i) => i !== index));
  }

  confirmarCombo(): void {
    const combo = this.comboModal();
    if (!combo || this.jugosElegidos().length !== combo.jugos) return;
    this.pos.agregarCombo(combo, this.jugosElegidos());
    this.cancelarCombo();
  }

  async registrarVenta(): Promise<void> {
    if (this.pos.items().length === 0) return;
    this.registrando.set(true);
    const id = await this.pos.registrar();
    this.registrando.set(false);
    if (id) this.mostrarToast(`✅ Venta #${id} registrada (${this.pos.metodoPago()})`);
    else this.mostrarToast('❌ Error al registrar la venta');
  }

    //  Cuántas veces se eligió un jugo en el modal actual
  jugoElegidoCantidad(nombre: string): number {
    return this.jugosElegidos().filter((j) => j === nombre).length;
  }

  private mostrarToast(t: string): void { this.toast.set(t); setTimeout(() => this.toast.set(null), 3000); }
}
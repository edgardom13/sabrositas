import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PosService, ComboPos } from '../../services/pos.service';
import { ProductosService, Producto } from '../../services/productos.service';

type Cat = 'todos' | 'combos' | 'empanada' | 'jugo' | 'frio' | 'salsa' | 'domicilio' | 'arroz' | 'asadura' | 'plastico' | 'papa';

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

  comboModal = signal<ComboPos | null>(null);
  empanadasElegidas = signal<string[]>([]); // Nuevo signal
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
    { valor: 'arroz', etiqueta: '🍚 Arroces' },
    { valor: 'asadura', etiqueta: '🥩 Asaduras' },
    { valor: 'plastico', etiqueta: '🛍️ Plásticos' },
    { valor: 'papa', etiqueta: '🥔 Papas' },
    { valor: 'domicilio', etiqueta: '🛵 Domicilio' },
  ];

  private ordenCat: Record<string, number> = {
    empanada: 0, jugo: 1, frio: 2, salsa: 3,
    arroz: 4, asadura: 5, plastico: 6, papa: 7, domicilio: 8,
  };

  private ordenDe(p: Producto): number { return (p as any).orden ?? 0; }

  async ngOnInit(): Promise<void> {
    await this.productos.cargar();
  }

  lista = computed(() => {
    const todos = [...this.productos.catalogoPos(), this.pos.productoDomicilio()];
    let l = todos;
    if (this.filtroCat() !== 'todos' && this.filtroCat() !== 'combos') {
      l = l.filter((p) => p.categoria === this.filtroCat());
    }
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

  combosLista = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    let l = this.pos.combos();
    if (q) l = l.filter((c) => c.nombre.toLowerCase().includes(q));
    return l;
  });

  resumenCombo(c: ComboPos): string {
    return `${c.cantidadEmpanadas} 🥟 + ${c.jugos} 🍹`;
  }

  // Modificado para limpiar empanadas también
  abrirComboModal(c: ComboPos): void { 
    this.empanadasElegidas.set([]); 
    this.jugosElegidos.set([]); 
    this.comboModal.set(c); 
  }
  
  cancelarCombo(): void { 
    this.comboModal.set(null); 
    this.empanadasElegidas.set([]); 
    this.jugosElegidos.set([]); 
  }

  // Nuevo método para elegir empanadas
  elegirEmpanada(nombre: string): void {
    const combo = this.comboModal();
    if (!combo) return;
    if (this.empanadasElegidas().length < combo.cantidadEmpanadas) {
      this.empanadasElegidas.update((l) => [...l, nombre]);
    }
  }

  quitarEmpanada(index: number): void {
    this.empanadasElegidas.update((l) => l.filter((_, i) => i !== index));
  }

  empanadaElegidaCantidad(nombre: string): number {
    return this.empanadasElegidas().filter((e) => e === nombre).length;
  }

  elegirJugo(nombre: string): void {
    const combo = this.comboModal();
    if (!combo) return;
    if (this.jugosElegidos().length < combo.jugos) {
      this.jugosElegidos.update((l) => [...l, nombre]);
    }
  }

  quitarJugo(index: number): void {
    this.jugosElegidos.update((l) => l.filter((_, i) => i !== index));
  }

  jugoElegidoCantidad(nombre: string): number {
    return this.jugosElegidos().filter((j) => j === nombre).length;
  }

  // Modificado para pasar empanadas elegidas
  confirmarCombo(): void {
    const combo = this.comboModal();
    if (!combo) return;
    if (this.empanadasElegidas().length !== combo.cantidadEmpanadas) return;
    if (this.jugosElegidos().length !== combo.jugos) return;
    this.pos.agregarCombo(combo, this.empanadasElegidas(), this.jugosElegidos());
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

  private mostrarToast(t: string): void {
    this.toast.set(t);
    setTimeout(() => this.toast.set(null), 3000);
  }
}
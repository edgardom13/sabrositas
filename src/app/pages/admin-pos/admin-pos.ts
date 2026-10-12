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

  // 🆕 Cantidades por producto para cada item del combo: [{ nombreProducto: cantidad }]
  eleccionesCombo = signal<Record<string, number>[]>([]);

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
    return c.items.map(i => `${i.cantidad}× ${i.etiqueta}`).join(' + ');
  }

    // 🆕 Agrupa las elecciones del combo: [{ nombre, cantidad }]
  resumenElecciones(combo: any): { nombre: string; cantidad: number }[] {
    const mapa = new Map<string, number>();
    for (const ele of combo?.elecciones || []) {
      for (const nombre of ele.nombres || []) {
        mapa.set(nombre, (mapa.get(nombre) || 0) + 1);
      }
    }
    return [...mapa.entries()].map(([nombre, cantidad]) => ({ nombre, cantidad }));
  }

  // ===== 🎁 MODAL DE COMBO (stepper) =====

  abrirComboModal(c: ComboPos): void { 
    this.eleccionesCombo.set(c.items.map(() => ({})));
    this.comboModal.set(c); 
  }
  
  cancelarCombo(): void { 
    this.comboModal.set(null); 
    this.eleccionesCombo.set([]);
  }

  // 🆕 Cantidad elegida de un producto en un item
  cantidadElegida(itemIndex: number, nombre: string): number {
    return this.eleccionesCombo()[itemIndex]?.[nombre] || 0;
  }

  // 🆕 Total elegido en un item (suma de todas las cantidades)
  totalElegido(itemIndex: number): number {
    const obj = this.eleccionesCombo()[itemIndex] || {};
    return Object.values(obj).reduce((t, n) => t + (n || 0), 0);
  }

  // 🆕 Sumar con stepper (respeta el cupo del item)
  sumarEleccion(itemIndex: number, nombre: string): void {
    const combo = this.comboModal();
    if (!combo) return;
    const item = combo.items[itemIndex];
    if (this.totalElegido(itemIndex) >= item.cantidad) return;
    this.eleccionesCombo.update(all => {
      const nuevo = [...all];
      const obj = { ...(nuevo[itemIndex] || {}) };
      obj[nombre] = (obj[nombre] || 0) + 1;
      nuevo[itemIndex] = obj;
      return nuevo;
    });
  }

  // 🆕 Restar con stepper
  restarEleccion(itemIndex: number, nombre: string): void {
    this.eleccionesCombo.update(all => {
      const nuevo = [...all];
      const obj = { ...(nuevo[itemIndex] || {}) };
      if ((obj[nombre] || 0) > 0) {
        obj[nombre] -= 1;
        if (obj[nombre] === 0) delete obj[nombre];
      }
      nuevo[itemIndex] = obj;
      return nuevo;
    });
  }

  productosDeItem(item: { categoria: string }): Producto[] {
    return this.productos.productosPorCategoriaPos(item.categoria as any);
  }

  comboCompleto = computed(() => {
    const combo = this.comboModal();
    if (!combo) return false;
    return combo.items.every((item, idx) => this.totalElegido(idx) === item.cantidad);
  });

  confirmarCombo(): void {
    const combo = this.comboModal();
    if (!combo || !this.comboCompleto()) return;
    const elecciones = combo.items.map((item, idx) => {
      const obj = this.eleccionesCombo()[idx] || {};
      const nombres: string[] = [];
      Object.entries(obj).forEach(([nombre, cant]) => {
        for (let i = 0; i < cant; i++) nombres.push(nombre);
      });
      return { categoria: item.categoria, etiqueta: item.etiqueta, nombres };
    });
    this.pos.agregarCombo(combo, elecciones);
    this.cancelarCombo();
  }

  // ===== 💰 VENTA =====

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

  crearNuevoPedido(): void {
    this.pos.crearNuevoPedido();
    this.mostrarToast('✨ Nuevo pedido creado');
  }

  cambiarPedido(id: string): void {
    this.pos.cambiarPedido(id);
  }

  cerrarPedido(id: string): void {
    const pedido = this.pos.pedidosActivos().find(p => p.id === id);
    if (pedido && pedido.items.length > 0) {
      if (!confirm(`¿Cerrar "${pedido.nombre}"? Se perderán los productos agregados.`)) {
        return;
      }
    }
    this.pos.cerrarPedido(id);
  }

  calcularTotalPedido(pedido: any): number {
    const items = pedido.items || [];
    const subtotal = items
      .filter((i: any) => i.producto.id !== -999)
      .reduce((t: number, i: any) => t + i.cantidad * Number(i.producto.precio), 0);
    const domicilio = pedido.tipoEntrega === 'domicilio' ? 3000 : 0;
    const descuento = pedido.descuentoManual || 0;
    return Math.max(0, subtotal - descuento + domicilio);
  }

  formatearPrecio(v: number): string {
    return '$' + Number(v).toLocaleString('es-CO');
  }

     // ===== 🍚 MODAL DE ARROZ (extra sobre precio estándar) =====
  modalArroz = signal<Producto | null>(null);
  montoExtra = signal(0);            // Extra en pesos sobre el precio estándar
  modoManualArroz = signal(false);

  // Montos extra rápidos
  montosRapidos = [1000, 2000, 3000, 5000];

  abrirModalArroz(p: Producto): void {
    if (p.categoria === 'arroz') {
      this.modalArroz.set(p);
      this.montoExtra.set(0);
      this.modoManualArroz.set(false);
    } else {
      this.pos.agregar(p);
    }
  }

  // Toggle: si ya está seleccionado ese extra, lo quita
  seleccionarExtra(monto: number): void {
    this.montoExtra.set(this.montoExtra() === monto ? 0 : monto);
    this.modoManualArroz.set(false);
  }

  activarModoManual(): void {
    this.modoManualArroz.set(true);
  }

  onExtraManualChange(event: Event): void {
    const valor = +(event.target as HTMLInputElement).value || 0;
    this.montoExtra.set(valor);
  }

  // Total del arroz = precio estándar + extra
  totalArroz(): number {
    const p = this.modalArroz();
    if (!p) return 0;
    return Number(p.precio) + this.montoExtra();
  }

  confirmarArroz(): void {
  const p = this.modalArroz();
  if (!p) return;
  const extra = this.montoExtra();

  if (extra > 0) {
    // Arroz con extra: ID único negativo para que sea una línea separada
    const virtual = {
      ...p,
      id: -(Date.now() + Math.floor(Math.random() * 1000)), // ID único negativo
      nombre: `${p.nombre} (+$${extra.toLocaleString('es-CO')} extra)`,
      precio: Number(p.precio) + extra,
    };
    this.pos.agregar(virtual);
    this.mostrarToast(`✅ ${p.nombre} + extra = $${this.totalArroz().toLocaleString('es-CO')}`);
  } else {
    // Sin extra: agrega el arroz estándar
    this.pos.agregar(p);
    this.mostrarToast(`✅ ${p.nombre} agregado`);
  }

  this.cerrarModalArroz();
}

  cerrarModalArroz(): void {
    this.modalArroz.set(null);
    this.montoExtra.set(0);
    this.modoManualArroz.set(false);
  }
}
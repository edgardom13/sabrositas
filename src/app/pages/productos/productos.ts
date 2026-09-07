import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductosService, Producto, ProductoInput, CategoriaProducto, Combo, ComboInput, ComboItem, ETIQUETAS_CATEGORIA } from '../../services/productos.service';
import { SupabaseService } from '../../services/supabase';
import { CATEGORIAS_DISPONIBLES } from '../../data/productos';

const FORM_PRODUCTO_VACIO: ProductoInput = {
  nombre: '', precio: 0, imagen: '', imagen_pos: null,
  categoria: 'empanada', orden: 0, activo: true, activo_pos: true,
};

const ITEM_VACIO: ComboItem = { categoria: 'empanada', cantidad: 1, etiqueta: 'Empanadas' };

@Component({
  selector: 'app-productos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './productos.html',
  styleUrl: './productos.css',
})
export class Productos implements OnInit {
  service = inject(ProductosService);
  private supabase = inject(SupabaseService);

  categorias = CATEGORIAS_DISPONIBLES;
  etiquetasCategoria = ETIQUETAS_CATEGORIA;
  filtroCategoria = signal<'todas' | CategoriaProducto>('todas');
  busqueda = signal('');
  mensaje = signal<string | null>(null);

  vista = signal<'productos' | 'combos'>('productos');

  // Form producto
  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);
  formulario = signal<ProductoInput>({ ...FORM_PRODUCTO_VACIO });
  subiendoImagen = signal(false);
  subiendoImagenPos = signal(false);

  // Form combo
  mostrarFormCombo = signal(false);
  editandoComboId = signal<number | null>(null);
  formCombo = signal<{
    nombre: string; precio: number; imagen: string | null;
    activo: boolean; activo_pos: boolean; orden: number;
    items: ComboItem[];
  }>({
    nombre: '', precio: 0, imagen: null,
    activo: true, activo_pos: true, orden: 0,
    items: [{ ...ITEM_VACIO }],
  });
  subiendoImagenCombo = signal(false);

  productosFiltrados = computed(() => {
    let lista = this.service.productos();
    const cat = this.filtroCategoria();
    if (cat !== 'todas') lista = lista.filter((p) => p.categoria === cat);
    const q = this.busqueda().trim().toLowerCase();
    if (q) lista = lista.filter((p) => p.nombre.toLowerCase().includes(q));
    return [...lista].sort((a, b) => a.orden - b.orden || a.id - b.id);
  });

  combosFiltrados = computed(() => {
    const q = this.busqueda().trim().toLowerCase();
    let lista = this.service.combos();
    if (q) lista = lista.filter((c) => c.nombre.toLowerCase().includes(q));
    return [...lista].sort((a, b) => a.orden - b.orden || a.id - b.id);
  });

  ngOnInit(): void {
    this.service.cargar();
    this.service.cargarCombos();
  }

  actualizarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  cambiarFiltro(valor: 'todas' | CategoriaProducto): void {
    this.filtroCategoria.set(valor);
  }

  // ===== PRODUCTOS =====
  nuevo(): void {
    this.vista.set('productos');
    this.editandoId.set(null);
    this.formulario.set({ ...FORM_PRODUCTO_VACIO, orden: this.service.productos().length + 1 });
    this.mostrarFormulario.set(true);
    this.mostrarFormCombo.set(false);
  }

  editar(p: Producto): void {
    this.editandoId.set(p.id);
    this.formulario.set({
      nombre: p.nombre, precio: p.precio, imagen: p.imagen, imagen_pos: p.imagen_pos,
      categoria: p.categoria, orden: p.orden, activo: p.activo, activo_pos: p.activo_pos,
    });
    this.mostrarFormulario.set(true);
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.formulario.set({ ...FORM_PRODUCTO_VACIO });
    this.mostrarFormulario.set(false);
  }

  async subirImagen(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.subiendoImagen.set(true);
    const nombreUnico = `${Date.now()}-${archivo.name.replace(/\s+/g, '-')}`;
    const { error } = await this.supabase.client.storage.from('productos').upload(nombreUnico, archivo);
    if (error) { this.subiendoImagen.set(false); return; }
    const { data } = this.supabase.client.storage.from('productos').getPublicUrl(nombreUnico);
    this.formulario.update((f) => ({ ...f, imagen: data.publicUrl }));
    this.subiendoImagen.set(false);
  }

  async subirImagenPos(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.subiendoImagenPos.set(true);
    const nombreUnico = `${Date.now()}-pos-${archivo.name.replace(/\s+/g, '-')}`;
    const { error } = await this.supabase.client.storage.from('productos').upload(nombreUnico, archivo);
    if (error) { this.subiendoImagenPos.set(false); return; }
    const { data } = this.supabase.client.storage.from('productos').getPublicUrl(nombreUnico);
    this.formulario.update((f) => ({ ...f, imagen_pos: data.publicUrl }));
    this.subiendoImagenPos.set(false);
  }

  async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f.nombre.trim() || f.precio < 0 || !f.imagen.trim()) {
      this.mostrarMensaje('⚠️ Completa nombre, imagen y precio');
      return;
    }
    let ok = false;
    if (this.editandoId() !== null) {
      ok = await this.service.actualizar(this.editandoId()!, f);
      if (ok) this.mostrarMensaje('✅ Producto actualizado');
    } else {
      ok = await this.service.crear(f);
      if (ok) this.mostrarMensaje('✅ Producto creado');
    }
    if (ok) this.cancelar();
  }

  async eliminar(p: Producto): Promise<void> {
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    const ok = await this.service.eliminar(p.id);
    if (ok) this.mostrarMensaje('🗑️ Producto eliminado');
  }

  async toggleActivo(p: Producto): Promise<void> {
    const ok = await this.service.toggleActivo(p.id, !p.activo);
    if (ok) this.mostrarMensaje(p.activo ? '🛍️ Oculto en TIENDA' : '🛍️ Visible en TIENDA');
  }

  async toggleActivoPos(p: Producto): Promise<void> {
    const ok = await this.service.toggleActivoPos(p.id, !p.activo_pos);
    if (ok) this.mostrarMensaje(p.activo_pos ? '🏪 Oculto en POS' : '🏪 Visible en POS');
  }

  // ===== 🎁 COMBOS =====
  nuevoCombo(): void {
    this.vista.set('combos');
    this.editandoComboId.set(null);
    this.formCombo.set({
      nombre: '', precio: 0, imagen: null,
      activo: true, activo_pos: true,
      orden: this.service.combos().length + 1,
      items: [{ ...ITEM_VACIO }],
    });
    this.mostrarFormCombo.set(true);
    this.mostrarFormulario.set(false);
  }

  editarCombo(c: Combo): void {
    this.editandoComboId.set(c.id);
    this.formCombo.set({
      nombre: c.nombre, precio: Number(c.precio),
      imagen: c.imagen, activo: c.activo, activo_pos: c.activo_pos, orden: c.orden,
      items: c.items && c.items.length > 0 ? [...c.items] : [{ ...ITEM_VACIO }],
    });
    this.mostrarFormCombo.set(true);
  }

  cancelarCombo(): void {
    this.editandoComboId.set(null);
    this.mostrarFormCombo.set(false);
  }

  agregarItemAlCombo(): void {
    this.formCombo.update(f => ({ ...f, items: [...f.items, { ...ITEM_VACIO }] }));
  }

  quitarItemDelCombo(index: number): void {
    this.formCombo.update(f => ({ ...f, items: f.items.filter((_, i) => i !== index) }));
  }

  actualizarItemCombo(index: number, campo: 'categoria' | 'cantidad' | 'etiqueta', valor: any): void {
    this.formCombo.update(f => {
      const items = [...f.items];
      const item = { ...items[index], [campo]: valor };
      // Si cambia categoría, actualizar etiqueta automáticamente si está vacía o es genérica
      if (campo === 'categoria') {
        item.etiqueta = ETIQUETAS_CATEGORIA[valor as CategoriaProducto] || 'Productos';
      }
      items[index] = item;
      return { ...f, items };
    });
  }

  async subirImagenCombo(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.subiendoImagenCombo.set(true);
    const nombreUnico = `${Date.now()}-combo-${archivo.name.replace(/\s+/g, '-')}`;
    const { error } = await this.supabase.client.storage.from('productos').upload(nombreUnico, archivo);
    if (error) { this.subiendoImagenCombo.set(false); return; }
    const { data } = this.supabase.client.storage.from('productos').getPublicUrl(nombreUnico);
    this.formCombo.update((f) => ({ ...f, imagen: data.publicUrl }));
    this.subiendoImagenCombo.set(false);
  }

  async guardarCombo(): Promise<void> {
    const f = this.formCombo();
    if (!f.nombre.trim() || f.precio <= 0) {
      this.mostrarMensaje('⚠️ Nombre y precio son obligatorios');
      return;
    }
    if (f.items.length === 0) {
      this.mostrarMensaje('⚠️ Agrega al menos un item al combo');
      return;
    }
    if (f.items.some(i => i.cantidad < 1)) {
      this.mostrarMensaje('⚠️ Cada item debe tener cantidad ≥ 1');
      return;
    }

    const input: ComboInput = {
      nombre: f.nombre, precio: f.precio, items: f.items,
      imagen: f.imagen, activo: f.activo, activo_pos: f.activo_pos, orden: f.orden,
    };

    let ok = false;
    if (this.editandoComboId() !== null) {
      ok = await this.service.actualizarCombo(this.editandoComboId()!, input);
      if (ok) this.mostrarMensaje('✅ Combo actualizado');
    } else {
      ok = await this.service.crearCombo(input);
      if (ok) this.mostrarMensaje('✅ Combo creado');
    }
    if (ok) this.cancelarCombo();
  }

  async eliminarCombo(c: Combo): Promise<void> {
    if (!confirm(`¿Eliminar el combo "${c.nombre}"?`)) return;
    const ok = await this.service.eliminarCombo(c.id);
    if (ok) this.mostrarMensaje('🗑️ Combo eliminado');
  }

  async toggleComboActivo(c: Combo): Promise<void> {
    const ok = await this.service.toggleComboActivo(c.id, !c.activo);
    if (ok) this.mostrarMensaje(c.activo ? '🛍️ Combo oculto en TIENDA' : '🛍️ Combo visible en TIENDA');
  }

  async toggleComboActivoPos(c: Combo): Promise<void> {
    const ok = await this.service.toggleComboActivoPos(c.id, !c.activo_pos);
    if (ok) this.mostrarMensaje(c.activo_pos ? '🏪 Combo oculto en POS' : '🏪 Combo visible en POS');
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }

  formatearPrecio(valor: number): string {
    return '$' + Number(valor).toLocaleString('es-CO');
  }
}
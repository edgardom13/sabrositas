import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductosService, Producto, ProductoInput, CategoriaProducto } from '../../services/productos.service';
import { SupabaseService } from '../../services/supabase';
import { CATEGORIAS_DISPONIBLES } from '../../data/productos';

const FORM_VACIO: ProductoInput = {
  nombre: '',
  precio: 0,
  imagen: '',
  imagen_pos: null,
  categoria: 'empanada',
  orden: 0,
  activo: true,
  activo_pos: true,
};

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
  filtroCategoria = signal<'todas' | CategoriaProducto>('todas');
  busqueda = signal('');
  mensaje = signal<string | null>(null);

  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);
  formulario = signal<ProductoInput>({ ...FORM_VACIO });
  subiendoImagen = signal(false);
  subiendoImagenPos = signal(false);

  productosFiltrados = computed(() => {
    let lista = this.service.productos();
    const cat = this.filtroCategoria();
    if (cat !== 'todas') lista = lista.filter((p) => p.categoria === cat);
    const q = this.busqueda().trim().toLowerCase();
    if (q) lista = lista.filter((p) => p.nombre.toLowerCase().includes(q));
    return [...lista].sort((a, b) => a.orden - b.orden || a.id - b.id);
  });

  ngOnInit(): void {
    this.service.cargar();
  }

  actualizarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  cambiarFiltro(valor: 'todas' | CategoriaProducto): void {
    this.filtroCategoria.set(valor);
  }

  nuevo(): void {
    this.editandoId.set(null);
    this.formulario.set({ ...FORM_VACIO, orden: this.service.productos().length + 1 });
    this.mostrarFormulario.set(true);
  }

  editar(p: Producto): void {
    this.editandoId.set(p.id);
    this.formulario.set({
      nombre: p.nombre,
      precio: p.precio,
      imagen: p.imagen,
      imagen_pos: p.imagen_pos,
      categoria: p.categoria,
      orden: p.orden,
      activo: p.activo,
      activo_pos: p.activo_pos,
    });
    this.mostrarFormulario.set(true);
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.formulario.set({ ...FORM_VACIO });
    this.mostrarFormulario.set(false);
  }

  async subirImagen(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.subiendoImagen.set(true);
    const nombreUnico = `${Date.now()}-${archivo.name.replace(/\s+/g, '-')}`;
    const { error } = await this.supabase.client.storage.from('productos').upload(nombreUnico, archivo);
    if (error) {
      console.error('❌ Error al subir imagen:', error.message);
      this.mostrarMensaje('⚠️ No se pudo subir la imagen');
      this.subiendoImagen.set(false);
      return;
    }
    const { data } = this.supabase.client.storage.from('productos').getPublicUrl(nombreUnico);
    this.formulario.update((f) => ({ ...f, imagen: data.publicUrl }));
    this.subiendoImagen.set(false);
    this.mostrarMensaje('✅ Imagen de tienda cargada');
  }

  async subirImagenPos(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    this.subiendoImagenPos.set(true);
    const nombreUnico = `${Date.now()}-pos-${archivo.name.replace(/\s+/g, '-')}`;
    const { error } = await this.supabase.client.storage.from('productos').upload(nombreUnico, archivo);
    if (error) {
      console.error('❌ Error al subir imagen POS:', error.message);
      this.mostrarMensaje('⚠️ No se pudo subir la imagen POS');
      this.subiendoImagenPos.set(false);
      return;
    }
    const { data } = this.supabase.client.storage.from('productos').getPublicUrl(nombreUnico);
    this.formulario.update((f) => ({ ...f, imagen_pos: data.publicUrl }));
    this.subiendoImagenPos.set(false);
    this.mostrarMensaje('✅ Imagen de POS cargada');
  }

  async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f.nombre.trim() || f.precio < 0 || !f.imagen.trim()) {
      this.mostrarMensaje('⚠️ Completa nombre, imagen de tienda y precio válido');
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
    if (!confirm(`¿Eliminar "${p.nombre}"?\nEsta acción no se puede deshacer.`)) return;
    const ok = await this.service.eliminar(p.id);
    if (ok) this.mostrarMensaje('🗑️ Producto eliminado');
  }

  // 🛍️ Ojito TIENDA
  async toggleActivo(p: Producto): Promise<void> {
    const nuevo = !p.activo;
    const ok = await this.service.toggleActivo(p.id, nuevo);
    if (ok) this.mostrarMensaje(nuevo ? '🛍️ Visible en TIENDA' : '🛍️ Oculto en TIENDA');
  }

  // 🏪 Ojito POS
  async toggleActivoPos(p: Producto): Promise<void> {
    const nuevo = !p.activo_pos;
    const ok = await this.service.toggleActivoPos(p.id, nuevo);
    if (ok) this.mostrarMensaje(nuevo ? '🏪 Visible en POS' : '🏪 Oculto en POS');
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }

  formatearPrecio(valor: number): string {
    return '$' + Number(valor).toLocaleString('es-CO');
  }
}
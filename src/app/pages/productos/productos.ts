import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductosService, Producto, ProductoInput, CategoriaProducto } from '../../services/productos.service';
import { SupabaseService } from '../../services/supabase';
import { CATEGORIAS_DISPONIBLES } from '../../data/productos';

const FORM_VACIO: ProductoInput = {
  nombre: '',
  precio: 0,
  imagen: '',
  categoria: 'empanada',
  orden: 0,
  activo: true,
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

  // ✅ Ahora el formulario se controla con este signal
  mostrarFormulario = signal(false);
  editandoId = signal<number | null>(null);
  formulario = signal<ProductoInput>({ ...FORM_VACIO });
  subiendoImagen = signal(false);

  // ✅ Filtros reactivos con computed (sin setInterval)
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
    this.formulario.set({
      ...FORM_VACIO,
      orden: this.service.productos().length + 1,
    });
    this.mostrarFormulario.set(true); // ✅ ahora sí abre el formulario
  }

  editar(p: Producto): void {
    this.editandoId.set(p.id);
    this.formulario.set({
      nombre: p.nombre,
      precio: p.precio,
      imagen: p.imagen,
      categoria: p.categoria,
      orden: p.orden,
      activo: p.activo,
    });
    this.mostrarFormulario.set(true);
  }

  cancelar(): void {
    this.editandoId.set(null);
    this.formulario.set({ ...FORM_VACIO });
    this.mostrarFormulario.set(false);
  }

  // ===== 📷 Subir imagen a Supabase Storage =====
  async subirImagen(evento: Event): Promise<void> {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;

    this.subiendoImagen.set(true);
    const nombreUnico = `${Date.now()}-${archivo.name.replace(/\s+/g, '-')}`;

    const { error } = await this.supabase.client.storage
      .from('productos')
      .upload(nombreUnico, archivo);

    if (error) {
      console.error('❌ Error al subir imagen:', error.message);
      this.mostrarMensaje('⚠️ No se pudo subir la imagen');
      this.subiendoImagen.set(false);
      return;
    }

    const { data } = this.supabase.client.storage
      .from('productos')
      .getPublicUrl(nombreUnico);

    // La URL pública se coloca sola en el campo de imagen
    this.formulario.update((f) => ({ ...f, imagen: data.publicUrl }));
    this.subiendoImagen.set(false);
    this.mostrarMensaje('✅ Imagen cargada');
  }

  async guardar(): Promise<void> {
    const f = this.formulario();
    if (!f.nombre.trim() || f.precio < 0 || !f.imagen.trim()) {
      this.mostrarMensaje('⚠️ Completa nombre, imagen y precio válido');
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

  async toggleActivo(p: Producto): Promise<void> {
    const nuevoEstado = !p.activo;
    const ok = await this.service.toggleActivo(p.id, nuevoEstado);
    if (ok) this.mostrarMensaje(nuevoEstado ? '✅ Producto activado' : '⏸️ Producto ocultado');
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }

  formatearPrecio(valor: number): string {
    return '$' + Number(valor).toLocaleString('es-CO');
  }
}
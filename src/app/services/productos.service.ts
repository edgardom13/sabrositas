import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase';

export type CategoriaProducto = 'empanada' | 'jugo' | 'frio' | 'salsa';

export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
  categoria: CategoriaProducto;
  orden: number;
  activo: boolean;
}

export interface ProductoInput {
  nombre: string;
  precio: number;
  imagen: string;
  categoria: CategoriaProducto;
  orden: number;
  activo: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private supabase = inject(SupabaseService);

  productos = signal<Producto[]>([]);
  cargando = signal(false);

  // Solo los activos y ordenados (lo que ve la tienda)
  catalogo = computed(() =>
    this.productos()
      .filter((p) => p.activo)
      .sort((a, b) => a.orden - b.orden || a.id - b.id),
  );

  empanadas = computed(() => this.catalogo().filter((p) => p.categoria === 'empanada'));
  jugos = computed(() => this.catalogo().filter((p) => p.categoria === 'jugo'));
  frios = computed(() => this.catalogo().filter((p) => p.categoria === 'frio'));
  salsas = computed(() => this.catalogo().filter((p) => p.categoria === 'salsa'));

  async cargar(): Promise<void> {
    this.cargando.set(true);
    const { data, error } = await this.supabase.client
      .from('productos')
      .select('*')
      .order('orden', { ascending: true });
    this.cargando.set(false);

    if (error) {
      console.error('❌ Error al cargar productos:', error.message);
      return;
    }
    this.productos.set((data as Producto[]) ?? []);
  }

  async crear(input: ProductoInput): Promise<boolean> {
    const { error, data } = await this.supabase.client
      .from('productos')
      .insert([input])
      .select()
      .single();

    if (error) {
      console.error('❌ Error al crear:', error.message);
      return false;
    }
    this.productos.update((lista) => [...lista, data as Producto]);
    return true;
  }

  async actualizar(id: number, input: ProductoInput): Promise<boolean> {
    const { error, data } = await this.supabase.client
      .from('productos')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error al actualizar:', error.message);
      return false;
    }
    this.productos.update((lista) =>
      lista.map((p) => (p.id === id ? (data as Producto) : p)),
    );
    return true;
  }

  async eliminar(id: number): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('productos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error al eliminar:', error.message);
      return false;
    }
    this.productos.update((lista) => lista.filter((p) => p.id !== id));
    return true;
  }

  async toggleActivo(id: number, activo: boolean): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('productos')
      .update({ activo })
      .eq('id', id);

    if (error) {
      console.error('❌ Error al cambiar estado:', error.message);
      return false;
    }
    this.productos.update((lista) =>
      lista.map((p) => (p.id === id ? { ...p, activo } : p)),
    );
    return true;
  }
}
import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService } from './supabase';

export type CategoriaProducto = 
  | 'empanada' | 'jugo' | 'frio' | 'salsa'
  | 'arroz' | 'asadura' | 'plastico' | 'papa';

export interface Producto {
  id: number;
  nombre: string;
  precio: number;
  imagen: string;
  imagen_pos: string | null;
  categoria: CategoriaProducto;
  orden: number;
  activo: boolean;
  activo_pos: boolean;
  detalle?: string;
}

export interface ProductoInput {
  nombre: string;
  precio: number;
  imagen: string;
  imagen_pos: string | null;
  categoria: CategoriaProducto;
  orden: number;
  activo: boolean;
  activo_pos: boolean;
}

// 🆕 Item flexible de combo (cualquier categoría + cantidad)
export interface ComboItem {
  categoria: CategoriaProducto;
  cantidad: number;
  etiqueta: string; // "Empanadas", "Jugos", "Arroz", etc.
}

// 🆕 Combo con items flexibles + dos ojitos (tienda / POS)
export interface Combo {
  id: number;
  nombre: string;
  precio: number;
  items: ComboItem[];
  imagen: string | null;
  activo: boolean;       // 👁️ visible en TIENDA
  activo_pos: boolean;   // 🏪 visible en POS
  orden: number;
  creado_en?: string;
}

export interface ComboInput {
  nombre: string;
  precio: number;
  items: ComboItem[];
  imagen: string | null;
  activo: boolean;
  activo_pos: boolean;
  orden: number;
}

// Etiquetas amigables por categoría
export const ETIQUETAS_CATEGORIA: Record<CategoriaProducto, string> = {
  empanada: 'Empanadas',
  jugo: 'Jugos',
  frio: 'Bebidas frías',
  salsa: 'Salsas',
  arroz: 'Arroces',
  asadura: 'Asaduras',
  plastico: 'Plásticos',
  papa: 'Papas',
};

@Injectable({ providedIn: 'root' })
export class ProductosService {
  private supabase = inject(SupabaseService);

  productos = signal<Producto[]>([]);
  combos = signal<Combo[]>([]);
  cargando = signal(false);
  cargandoCombos = signal(false);

  // 🛍️ Catálogo TIENDA
  catalogo = computed(() =>
    this.productos().filter((p) => p.activo).sort((a, b) => a.orden - b.orden || a.id - b.id),
  );

  // 🏪 Catálogo POS
  catalogoPos = computed(() =>
    this.productos().filter((p) => p.activo_pos).sort((a, b) => a.orden - b.orden || a.id - b.id),
  );

  // 🎁 Combos activos en TIENDA
  combosActivos = computed(() =>
    this.combos().filter((c) => c.activo).sort((a, b) => a.orden - b.orden || a.id - b.id),
  );

  // 🏪 Combos activos en POS
  combosActivosPos = computed(() =>
    this.combos().filter((c) => c.activo_pos).sort((a, b) => a.orden - b.orden || a.id - b.id),
  );

  // TIENDA
  empanadas = computed(() => this.catalogo().filter((p) => p.categoria === 'empanada'));
  jugos = computed(() => this.catalogo().filter((p) => p.categoria === 'jugo'));
  frios = computed(() => this.catalogo().filter((p) => p.categoria === 'frio'));
  salsas = computed(() => this.catalogo().filter((p) => p.categoria === 'salsa'));
  arroces = computed(() => this.catalogo().filter((p) => p.categoria === 'arroz'));
  asaduras = computed(() => this.catalogo().filter((p) => p.categoria === 'asadura'));
  plasticos = computed(() => this.catalogo().filter((p) => p.categoria === 'plastico'));
  papas = computed(() => this.catalogo().filter((p) => p.categoria === 'papa'));

  // POS
  empanadasPos = computed(() => this.catalogoPos().filter((p) => p.categoria === 'empanada'));
  jugosPos = computed(() => this.catalogoPos().filter((p) => p.categoria === 'jugo'));

  // 🆕 Productos de una categoría específica para el POS (para combos flexibles)
  productosPorCategoriaPos(cat: CategoriaProducto): Producto[] {
    return this.catalogoPos().filter((p) => p.categoria === cat);
  }

    // 🆕 Productos de una categoría visibles en TIENDA (para el modal de combos)
  productosPorCategoria(cat: CategoriaProducto): Producto[] {
    return this.catalogo().filter((p) => p.categoria === cat);
  }

  imagenParaPos(p: Producto): string {
    return p.imagen_pos || p.imagen;
  }

  // ===== PRODUCTOS =====
  async cargar(): Promise<void> {
    this.cargando.set(true);
    const { data, error } = await this.supabase.client
      .from('productos').select('*').order('orden', { ascending: true });
    this.cargando.set(false);
    if (error) { console.error('❌ Error:', error.message); return; }
    this.productos.set((data as Producto[]) ?? []);
  }

  async crear(input: ProductoInput): Promise<boolean> {
    const { error, data } = await this.supabase.client
      .from('productos').insert([input]).select().single();
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.productos.update((lista) => [...lista, data as Producto]);
    return true;
  }

  async actualizar(id: number, input: ProductoInput): Promise<boolean> {
    const { error, data } = await this.supabase.client
      .from('productos').update(input).eq('id', id).select().single();
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.productos.update((lista) => lista.map((p) => (p.id === id ? (data as Producto) : p)));
    return true;
  }

  async eliminar(id: number): Promise<boolean> {
    const { error } = await this.supabase.client.from('productos').delete().eq('id', id);
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.productos.update((lista) => lista.filter((p) => p.id !== id));
    return true;
  }

  async toggleActivo(id: number, activo: boolean): Promise<boolean> {
    const { error } = await this.supabase.client.from('productos').update({ activo }).eq('id', id);
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.productos.update((lista) => lista.map((p) => (p.id === id ? { ...p, activo } : p)));
    return true;
  }

  async toggleActivoPos(id: number, activo_pos: boolean): Promise<boolean> {
    const { error } = await this.supabase.client.from('productos').update({ activo_pos }).eq('id', id);
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.productos.update((lista) => lista.map((p) => (p.id === id ? { ...p, activo_pos } : p)));
    return true;
  }

  // ===== 🎁 COMBOS =====
  async cargarCombos(): Promise<void> {
    this.cargandoCombos.set(true);
    const { data, error } = await this.supabase.client
      .from('combos').select('*').order('orden', { ascending: true });
    this.cargandoCombos.set(false);
    if (error) { console.error('❌ Error:', error.message); return; }
    this.combos.set((data as Combo[]) ?? []);
  }

  async crearCombo(input: ComboInput): Promise<boolean> {
    const { error, data } = await this.supabase.client
      .from('combos').insert([input]).select().single();
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.combos.update((lista) => [...lista, data as Combo]);
    return true;
  }

  async actualizarCombo(id: number, input: ComboInput): Promise<boolean> {
    const { error, data } = await this.supabase.client
      .from('combos').update(input).eq('id', id).select().single();
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.combos.update((lista) => lista.map((c) => (c.id === id ? (data as Combo) : c)));
    return true;
  }

  async eliminarCombo(id: number): Promise<boolean> {
    const { error } = await this.supabase.client.from('combos').delete().eq('id', id);
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.combos.update((lista) => lista.filter((c) => c.id !== id));
    return true;
  }

  // 👁️ Ojito TIENDA
  async toggleComboActivo(id: number, activo: boolean): Promise<boolean> {
    const { error } = await this.supabase.client.from('combos').update({ activo }).eq('id', id);
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.combos.update((lista) => lista.map((c) => (c.id === id ? { ...c, activo } : c)));
    return true;
  }

  // 🏪 Ojito POS
  async toggleComboActivoPos(id: number, activo_pos: boolean): Promise<boolean> {
    const { error } = await this.supabase.client.from('combos').update({ activo_pos }).eq('id', id);
    if (error) { console.error('❌ Error:', error.message); return false; }
    this.combos.update((lista) => lista.map((c) => (c.id === id ? { ...c, activo_pos } : c)));
    return true;
  }

  generarImagenCombo(nombre: string): string {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd54f"/><stop offset="1" stop-color="#ff8f00"/></linearGradient></defs><rect width="300" height="200" fill="url(#g)"/><text x="150" y="112" font-size="80" text-anchor="middle">🎁</text><text x="150" y="170" font-size="24" fill="#5c1010" text-anchor="middle" font-family="Arial" font-weight="bold">${(nombre.length > 20 ? nombre.substring(0, 20) : nombre)}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
}
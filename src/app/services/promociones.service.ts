import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface PromoItem { productoId: number; cantidad: number; }
export interface Promocion {
  id: number; nombre: string; descripcion: string; imagen: string;
  precio: number; productos: PromoItem[]; activa: boolean; creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class PromocionesService {
  private supabase = inject(SupabaseService);
  todas = signal<Promocion[]>([]);
  activa = signal<Promocion | null>(null);

  async cargarTodas(): Promise<void> {
    const { data } = await this.supabase.client
      .from('promociones').select('*').order('creado_en', { ascending: false });
    this.todas.set((data as Promocion[]) ?? []);
  }

  async cargarActiva(): Promise<void> {
    const { data } = await this.supabase.client
      .from('promociones').select('*').eq('activa', true)
      .order('creado_en', { ascending: false }).limit(1).maybeSingle();
    this.activa.set((data as Promocion) ?? null);
  }

  async crear(p: Omit<Promocion, 'id' | 'creado_en'>): Promise<boolean> {
    const { error } = await this.supabase.client.from('promociones').insert([p]);
    if (error) return false;
    await this.cargarTodas();
    return true;
  }

  async toggle(id: number, activa: boolean): Promise<void> {
    await this.supabase.client.from('promociones').update({ activa }).eq('id', id);
    await this.cargarTodas();
    await this.cargarActiva();
  }

  async eliminar(id: number): Promise<void> {
    await this.supabase.client.from('promociones').delete().eq('id', id);
    await this.cargarTodas();
  }

  async subirImagen(file: File): Promise<string | null> {
    const path = `promos/${Date.now()}-${file.name}`;
    const { error } = await this.supabase.client.storage.from('sabrositas-img').upload(path, file);
    if (error) return null;
    return this.supabase.client.storage.from('sabrositas-img').getPublicUrl(path).data.publicUrl;
  }
}
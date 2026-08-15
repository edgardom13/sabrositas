import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface MensajeMarketing {
  id: number;
  titulo: string;
  mensaje: string;
  emoji: string;
  imagen: string | null;
  activa: boolean;
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class MensajesMarketingService {
  private supabase = inject(SupabaseService);

  todos = signal<MensajeMarketing[]>([]);
  activos = signal<MensajeMarketing[]>([]);

  async cargarTodos(): Promise<void> {
    const { data } = await this.supabase.client
      .from('mensajes_marketing').select('*').order('creado_en', { ascending: false });
    this.todos.set((data as MensajeMarketing[]) ?? []);
  }

  async cargarActivos(): Promise<void> {
    const { data } = await this.supabase.client
      .from('mensajes_marketing').select('*').eq('activa', true)
      .order('creado_en', { ascending: false });
    this.activos.set((data as MensajeMarketing[]) ?? []);
  }

  async crear(p: { titulo: string; mensaje: string; emoji: string; imagen: string | null }): Promise<boolean> {
    const { error } = await this.supabase.client.from('mensajes_marketing').insert([p]);
    if (error) return false;
    await this.cargarTodos();
    return true;
  }

  async toggle(id: number, activa: boolean): Promise<void> {
    await this.supabase.client.from('mensajes_marketing').update({ activa: !activa }).eq('id', id);
    await this.cargarTodos();
  }

  async eliminar(id: number): Promise<void> {
    await this.supabase.client.from('mensajes_marketing').delete().eq('id', id);
    await this.cargarTodos();
  }

  async subirImagen(file: File): Promise<string | null> {
    const path = `marketing/${Date.now()}-${file.name}`;
    const { error } = await this.supabase.client.storage.from('sabrositas-img').upload(path, file);
    if (error) return null;
    return this.supabase.client.storage.from('sabrositas-img').getPublicUrl(path).data.publicUrl;
  }
}
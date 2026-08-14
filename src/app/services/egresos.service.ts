import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Egreso {
  id: number; descripcion: string; categoria: string;
  monto: number; fecha: string; creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class EgresosService {
  private supabase = inject(SupabaseService);
  egresos = signal<Egreso[]>([]);

  async cargar(fecha: string): Promise<void> {
    const { data } = await this.supabase.client
      .from('egresos').select('*').eq('fecha', fecha)
      .order('creado_en', { ascending: false });
    this.egresos.set((data as Egreso[]) ?? []);
  }

  async agregar(e: { descripcion: string; categoria: string; monto: number; fecha: string }): Promise<boolean> {
    const { error } = await this.supabase.client.from('egresos').insert([e]);
    if (error) return false;
    await this.cargar(e.fecha);
    return true;
  }

  async eliminar(id: number, fecha: string): Promise<void> {
    await this.supabase.client.from('egresos').delete().eq('id', id);
    await this.cargar(fecha);
  }

  totalDia(): number {
    return this.egresos().reduce((t, e) => t + Number(e.monto), 0);
  }
}
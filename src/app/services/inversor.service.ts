import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Inversor {
  id: number;
  nombre: string;
  capital_invertido: number;
  porcentaje_ganancias: number;
  fecha_inicio: string | null;
  notas: string | null;
  activo: boolean;
  creado_en: string;
}

export interface PagoInversor {
  id: number;
  monto: number;
  concepto: string;
  fecha: string;
  tipo: 'mensual' | 'adelanto' | 'extra' | 'reintegro';
  inversor_id: number | null;
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class InversorService {
  private supabase = inject(SupabaseService);

  inversores = signal<Inversor[]>([]);
  pagos = signal<PagoInversor[]>([]);

  async cargarInversores(): Promise<void> {
    const { data } = await this.supabase.client
      .from('inversor').select('*').order('nombre');
    this.inversores.set((data as Inversor[]) ?? []);
  }

  async cargarPagos(): Promise<void> {
    const { data } = await this.supabase.client
      .from('pagos_inversor').select('*').order('fecha', { ascending: false });
    this.pagos.set((data as PagoInversor[]) ?? []);
  }

  async crear(p: Omit<Inversor, 'id' | 'creado_en' | 'activo'>): Promise<number | null> {
    const { data, error } = await this.supabase.client
      .from('inversor').insert([p]).select().single();
    if (error) return null;
    await this.cargarInversores();
    return (data as Inversor).id;
  }

  async actualizar(id: number, p: Partial<Inversor>): Promise<boolean> {
    const { error } = await this.supabase.client.from('inversor').update(p).eq('id', id);
    if (error) return false;
    await this.cargarInversores();
    return true;
  }

  async eliminar(id: number): Promise<void> {
    // Los pagos quedan sin asignar antes de borrar
    await this.supabase.client.from('pagos_inversor').update({ inversor_id: null }).eq('inversor_id', id);
    await this.supabase.client.from('inversor').delete().eq('id', id);
    await this.cargarInversores();
    await this.cargarPagos();
  }

  async registrarPago(p: { monto: number; concepto: string; fecha: string; tipo: string; inversor_id: number }): Promise<boolean> {
    const { error } = await this.supabase.client.from('pagos_inversor').insert([p]);
    if (error) return false;
    await this.cargarPagos();
    return true;
  }

  async eliminarPago(id: number): Promise<void> {
    await this.supabase.client.from('pagos_inversor').delete().eq('id', id);
    await this.cargarPagos();
  }

  formatearPrecio(v: number): string {
    return '$' + Number(v).toLocaleString('es-CO');
  }

  formatearFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
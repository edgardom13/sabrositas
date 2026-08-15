import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface Empleado {
  id: number;
  nombre: string;
  cargo: string;
  tipo_pago: 'diario' | 'mensual';
  salario: number;
  fecha_inicio: string | null;
  notas: string | null;
  activo: boolean;
  creado_en: string;
}

export interface PagoEmpleado {
  id: number;
  empleado_id: number | null;
  monto: number;
  concepto: string;
  fecha: string;
  tipo: 'mensual' | 'adelanto' | 'bono' | 'otro';
  creado_en: string;
}

@Injectable({ providedIn: 'root' })
export class EmpleadosService {
  private supabase = inject(SupabaseService);

  empleados = signal<Empleado[]>([]);
  pagos = signal<PagoEmpleado[]>([]);

  async cargarEmpleados(): Promise<void> {
    const { data } = await this.supabase.client.from('empleados').select('*').order('nombre');
    this.empleados.set((data as Empleado[]) ?? []);
  }

  async cargarPagos(): Promise<void> {
    const { data } = await this.supabase.client
      .from('pagos_empleado').select('*').order('fecha', { ascending: false });
    this.pagos.set((data as PagoEmpleado[]) ?? []);
  }

  async crear(p: Omit<Empleado, 'id' | 'creado_en' | 'activo'>): Promise<number | null> {
    const { data, error } = await this.supabase.client.from('empleados').insert([p]).select().single();
    if (error) return null;
    await this.cargarEmpleados();
    return (data as Empleado).id;
  }

  async actualizar(id: number, p: Partial<Empleado>): Promise<boolean> {
    const { error } = await this.supabase.client.from('empleados').update(p).eq('id', id);
    if (error) return false;
    await this.cargarEmpleados();
    return true;
  }

  async eliminar(id: number): Promise<void> {
    await this.supabase.client.from('pagos_empleado').update({ empleado_id: null }).eq('empleado_id', id);
    await this.supabase.client.from('empleados').delete().eq('id', id);
    await this.cargarEmpleados();
    await this.cargarPagos();
  }

  async registrarPago(p: { monto: number; concepto: string; fecha: string; tipo: string; empleado_id: number }): Promise<boolean> {
    const { error } = await this.supabase.client.from('pagos_empleado').insert([p]);
    if (error) return false;
    await this.cargarPagos();
    return true;
  }

  async eliminarPago(id: number): Promise<void> {
    await this.supabase.client.from('pagos_empleado').delete().eq('id', id);
    await this.cargarPagos();
  }

  formatearPrecio(v: number): string {
    return '$' + Number(v).toLocaleString('es-CO');
  }

  formatearFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
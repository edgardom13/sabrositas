import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface ConfigNegocio {
  id: number;
  whatsapp: string;
  domicilio: number;
  cupon_umbral: number;
  cupon_porcentaje: number;
  salsas_gratis: number;
  salsa_precio: number;
  puntos_referido: number;
  puntos_compra: number;
  plantilla_recibido: string;
  plantilla_camino: string;
  plantilla_entregado: string;
  tienda_cerrada: boolean;   // ← NUEVO
  mensaje_cierre: string;    // ← NUEVO
}

const DEFAULT: ConfigNegocio = {
  id: 1,
  whatsapp: '573012680659',
  domicilio: 3000,
  cupon_umbral: 30000,
  cupon_porcentaje: 10,
  salsas_gratis: 3,
  salsa_precio: 500,
  puntos_referido: 50,
  puntos_compra: 10,
  plantilla_recibido: '...',
  plantilla_camino: '...',
  plantilla_entregado: '...',
  tienda_cerrada: false,   // ← NUEVO
  mensaje_cierre: '',      // ← NUEVO
};

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private supabase = inject(SupabaseService);

  config = signal<ConfigNegocio>(DEFAULT);
  cargada = signal(false);

  async cargar(): Promise<void> {
    const { data } = await this.supabase.client
      .from('configuracion')
      .select('*')
      .limit(1)
      .maybeSingle();

    if (data) {
      this.config.set({ ...DEFAULT, ...data });
    }
    this.cargada.set(true);
  }

  async guardar(parcial: Partial<ConfigNegocio>): Promise<boolean> {
    const nuevo = { ...this.config(), ...parcial };
    const { error } = await this.supabase.client
      .from('configuracion')
      .upsert(nuevo);

    if (error) {
      console.error('❌ Error al guardar configuración:', error.message);
      return false;
    }

    this.config.set(nuevo);
    return true;
  }
}
import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';
import { AuthService } from './auth.service';

export interface Premio {
  id: number;
  nombre: string;
  puntos: number;
}

export interface Canje {
  id: number;
  codigo: string;
  estado: 'pendiente' | 'reclamado' | 'anulado';
  creado_en: string;
  premio_id: number;
}

@Injectable({ providedIn: 'root' })
export class ReferidosService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  premios = signal<Premio[]>([]);
  canjes = signal<Canje[]>([]);

  async cargarPremios(): Promise<void> {
    const { data } = await this.supabase.client
      .from('premios')
      .select('id, nombre, puntos')
      .eq('activo', true)
      .order('puntos', { ascending: true });
    this.premios.set((data as Premio[]) ?? []);
  }

  async cargarCanjes(): Promise<void> {
    const perfil = this.auth.perfil();
    if (!perfil) return;

    const { data } = await this.supabase.client
      .from('canjes')
      .select('*')
      .eq('usuario_id', perfil.id)
      .order('creado_en', { ascending: false });
    this.canjes.set((data as Canje[]) ?? []);
  }

  async canjear(premio: Premio): Promise<{ ok: boolean; error?: string }> {
    const perfil = this.auth.perfil();
    if (!perfil) return { ok: false, error: 'Sesión no válida' };
    if (perfil.puntos < premio.puntos) {
      return { ok: false, error: 'No tienes puntos suficientes' };
    }

    // 1. Descontar puntos
    const { error: e1 } = await this.supabase.client
      .from('perfiles')
      .update({ puntos: perfil.puntos - premio.puntos })
      .eq('id', perfil.id);
    if (e1) return { ok: false, error: 'Error al descontar puntos' };

    // 2. Crear canje con código único
    const codigo = 'CANJE-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { error: e2 } = await this.supabase.client
      .from('canjes')
      .insert([{ usuario_id: perfil.id, premio_id: premio.id, codigo }]);

    if (e2) {
      // Revertir puntos si falló
      await this.supabase.client
        .from('perfiles')
        .update({ puntos: perfil.puntos })
        .eq('id', perfil.id);
      return { ok: false, error: 'Error al crear el canje' };
    }

    await this.auth.cargarPerfil();
    await this.cargarCanjes();
    return { ok: true };
  }

  linkReferido(): string {
    const perfil = this.auth.perfil();
    if (!perfil?.codigo_referido) return '';
    return `${window.location.origin}/?ref=${perfil.codigo_referido}`;
  }

    // 🛒 Pedidos del cliente (por teléfono) para seguimiento
  misPedidos = signal<any[]>([]);

  async cargarMisPedidos(): Promise<void> {
    const perfil = this.auth.perfil();
    if (!perfil?.telefono) { this.misPedidos.set([]); return; }

    const tel = perfil.telefono.replace(/\D/g, '');
    const { data } = await this.supabase.client
      .from('pedidos')
      .select('*')
      .order('creado_en', { ascending: false });

    const mios = ((data as any[]) ?? []).filter(
      (p) => (p.telefono || '').replace(/\D/g, '') === tel,
    );
    this.misPedidos.set(mios);
  }


}
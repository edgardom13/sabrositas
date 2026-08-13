import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService, Pedido } from './supabase';
import { Perfil } from './auth.service';

export interface PremioAdmin { id: number; nombre: string; puntos: number; activo: boolean; }

export interface CanjeAdmin {
  id: number;
  codigo: string;
  estado: string;
  creado_en: string;
  usuario: { nombre: string } | null;
  premio: { nombre: string } | null;
}

@Injectable({ providedIn: 'root' })
export class ComunidadService {
  private supabase = inject(SupabaseService);

  perfiles = signal<Perfil[]>([]);
  pedidosReferidos = signal<Pedido[]>([]);
  canjes = signal<CanjeAdmin[]>([]);
  premios = signal<PremioAdmin[]>([]);
  cargando = signal(false);

  async cargarTodo(): Promise<void> {
    this.cargando.set(true);
    const [rPerfiles, rPedidos, rCanjes, rPremios] = await Promise.all([
      this.supabase.client.from('perfiles').select('*').order('puntos', { ascending: false }),
      this.supabase.client.from('pedidos').select('*').not('referido_por', 'is', null).order('creado_en', { ascending: false }),
      this.supabase.client.from('canjes').select('*, usuario:perfiles(nombre), premio:premios(nombre)').order('creado_en', { ascending: false }),
      this.supabase.client.from('premios').select('*').order('puntos', { ascending: true }),
    ]);
    this.cargando.set(false);

    if (rPerfiles.data) this.perfiles.set(rPerfiles.data as Perfil[]);
    if (rPedidos.data) this.pedidosReferidos.set(rPedidos.data as Pedido[]);
    if (rCanjes.data) this.canjes.set(rCanjes.data as CanjeAdmin[]);
    if (rPremios.data) this.premios.set(rPremios.data as PremioAdmin[]);
  }

  // ===== 🎟️ Canjes =====
  async estadoCanje(id: number, estado: 'reclamado' | 'anulado'): Promise<boolean> {
    const { error } = await this.supabase.client.from('canjes').update({ estado }).eq('id', id);
    if (error) return false;
    this.canjes.update((lista) => lista.map((c) => (c.id === id ? { ...c, estado } : c)));
    return true;
  }

  // ===== 🏆 Premios =====
  async guardarPremio(premio: { id?: number; nombre?: string; puntos?: number; activo?: boolean }): Promise<boolean> {
    const { id, ...resto } = premio;
    if (id) {
      const { error } = await this.supabase.client.from('premios').update(resto).eq('id', id);
      if (error) return false;
      this.premios.update((lista) => lista.map((p) => (p.id === id ? { ...p, ...resto } : p)));
    } else {
      const { error } = await this.supabase.client.from('premios').insert([{ ...resto, activo: true }]);
      if (error) return false;
      await this.cargarTodo();
    }
    return true;
  }

  // ===== 👥 Usuarios =====
  async crearUsuario(datos: { email: string; password: string; nombre: string; telefono: string; rol: string }): Promise<{ ok: boolean; error?: string }> {
    const { error } = await this.supabase.client.rpc('admin_crear_usuario', {
      p_email: datos.email,
      p_password: datos.password,
      p_nombre: datos.nombre,
      p_telefono: datos.telefono,
      p_rol: datos.rol,
    });
    if (error) return { ok: false, error: error.message };
    await this.cargarTodo();
    return { ok: true };
  }

    async ajustarPuntos(id: string, puntosNuevos: number, puntosActuales: number): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('perfiles')
      .update({ puntos: puntosNuevos })
      .eq('id', id);
    if (error) return false;

    const delta = puntosNuevos - puntosActuales;
    if (delta !== 0) {
      await this.supabase.client.from('movimientos_puntos').insert([
        { usuario_id: id, cantidad: delta, concepto: 'Ajuste manual del administrador' },
      ]);
    }

    this.perfiles.update((lista) => lista.map((p) => (p.id === id ? { ...p, puntos: puntosNuevos } : p)));
    return true;
  }
}
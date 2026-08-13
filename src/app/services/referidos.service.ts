import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';
import { AuthService } from './auth.service';

export interface Premio {
  id: number;
  nombre: string;
  puntos: number;
  tipo?: string;
  valor?: number;
  cantidad?: number;   // ← NUEVO
}

export interface Canje {
  id: number;
  codigo: string;
  estado: 'pendiente' | 'reclamado' | 'anulado';
  creado_en: string;
  premio_id: number;
  premio?: { nombre: string; tipo: string; valor: number; cantidad: number } | null; // ← cantidad
}

export interface Movimiento {
  id: number;
  cantidad: number;
  concepto: string;
  creado_en: string;
}

export interface ProductoCanje {
  productoId: number;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class ReferidosService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  premios = signal<Premio[]>([]);
  canjes = signal<Canje[]>([]);
  movimientos = signal<Movimiento[]>([]);
  misPedidos = signal<any[]>([]);

  async cargarPremios(): Promise<void> {
    const { data } = await this.supabase.client
      .from('premios')
      .select('id, nombre, puntos, tipo, valor')
      .eq('activo', true)
      .order('puntos', { ascending: true });
    this.premios.set((data as Premio[]) ?? []);
  }

  async cargarMovimientos(): Promise<void> {
    const perfil = this.auth.perfil();
    if (!perfil) return;
    const { data } = await this.supabase.client
      .from('movimientos_puntos')
      .select('*')
      .eq('usuario_id', perfil.id)
      .order('creado_en', { ascending: false });
    this.movimientos.set((data as Movimiento[]) ?? []);
  }

  async cargarCanjes(): Promise<void> {
    const perfil = this.auth.perfil();
    if (!perfil) return;
    const { data } = await this.supabase.client
      .from('canjes')
      .select('*, premio:premios(nombre, tipo, valor, cantidad)')
      .eq('usuario_id', perfil.id)
      .order('creado_en', { ascending: false });
    this.canjes.set((data as Canje[]) ?? []);
  }

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

  // ✅ Tipo de retorno ahora incluye codigo opcional
    // ✅ Tipo de retorno ahora incluye el canje creado
  async canjear(premio: Premio): Promise<{
    ok: boolean;
    error?: string;
    canje?: { id: number; codigo: string };
  }> {
    const perfil = this.auth.perfil();
    if (!perfil) return { ok: false, error: 'Sesión no válida' };
    if (perfil.puntos < premio.puntos) {
      return { ok: false, error: 'No tienes puntos suficientes' };
    }

    const { error: e1 } = await this.supabase.client
      .from('perfiles')
      .update({ puntos: perfil.puntos - premio.puntos })
      .eq('id', perfil.id);
    if (e1) return { ok: false, error: 'Error al descontar puntos' };

    const codigo = 'CANJE-' + Math.random().toString(36).slice(2, 8).toUpperCase();
    const { data, error: e2 } = await this.supabase.client
      .from('canjes')
      .insert([{ usuario_id: perfil.id, premio_id: premio.id, codigo }])
      .select()
      .single();

    if (e2) {
      await this.supabase.client
        .from('perfiles')
        .update({ puntos: perfil.puntos })
        .eq('id', perfil.id);
      return { ok: false, error: 'Error al crear el canje' };
    }

    await this.supabase.client.from('movimientos_puntos').insert([
      {
        usuario_id: perfil.id,
        cantidad: -premio.puntos,
        concepto: `Canje ${codigo} · ${premio.nombre}`,
        referencia: `canje:${codigo}`,
      },
    ]);

    await this.auth.cargarPerfil();
    await this.cargarCanjes();
    await this.cargarMovimientos();

    return { ok: true, canje: { id: (data as any).id, codigo } };
  }

  prepararCanjeParaTienda(codigo: string, productos: ProductoCanje[]): void {
    localStorage.setItem('canje_pendiente', codigo);
    localStorage.setItem('canje_productos', JSON.stringify(productos));
  }

  linkReferido(): string {
    const perfil = this.auth.perfil();
    if (!perfil?.codigo_referido) return '';
    return `${window.location.origin}/?ref=${perfil.codigo_referido}`;
  }

  async asegurarCodigo(): Promise<void> {
    const perfil = this.auth.perfil();
    if (!perfil || perfil.codigo_referido) return;

    let codigo = '';
    for (let i = 0; i < 5; i++) {
      const candidato = 'SABRO-' + Math.random().toString(36).slice(2, 8).toUpperCase();
      const { data } = await this.supabase.client
        .from('perfiles')
        .select('id')
        .eq('codigo_referido', candidato)
        .maybeSingle();
      if (!data) { codigo = candidato; break; }
    }
    if (!codigo) codigo = 'SABRO-' + Date.now().toString(36).toUpperCase().slice(-6);

    const { error } = await this.supabase.client
      .from('perfiles')
      .update({ codigo_referido: codigo })
      .eq('id', perfil.id);

    if (!error) await this.auth.cargarPerfil();
  }
    // 🛒 Mapea el nombre del premio a productos del catálogo
  mapearPremioAProductos(premioNombre: string): { productoId: number; cantidad: number }[] {
    const n = premioNombre.toLowerCase();
    if (n.includes('1 empanada')) return [{ productoId: 1, cantidad: 1 }];
    if (n.includes('2 empanadas')) return [{ productoId: 1, cantidad: 2 }];
    if (n.includes('3 empanadas')) return [{ productoId: 1, cantidad: 3 }];
    if (n.includes('1 jugo')) return [{ productoId: 5, cantidad: 1 }];
    if (n.includes('2 jugos')) return [{ productoId: 5, cantidad: 2 }];
    if (n.includes('1 empanada + 1 jugo')) return [{ productoId: 1, cantidad: 1 }, { productoId: 5, cantidad: 1 }];
    if (n.includes('2 empanadas + 1 jugo')) return [{ productoId: 1, cantidad: 2 }, { productoId: 5, cantidad: 1 }];
    if (n.includes('2 empanadas + 2 jugos')) return [{ productoId: 1, cantidad: 2 }, { productoId: 5, cantidad: 2 }];
    if (n.includes('4 emp + 2 jugos')) return [{ productoId: 1, cantidad: 4 }, { productoId: 5, cantidad: 2 }];
    if (n.includes('6 emp + 3 jugos')) return [{ productoId: 1, cantidad: 6 }, { productoId: 5, cantidad: 3 }];
    if (n.includes('bandeja 5')) return [{ productoId: 1, cantidad: 5 }];
    if (n.includes('bandeja 10')) return [{ productoId: 1, cantidad: 10 }];
    if (n.includes('bandeja 15')) return [{ productoId: 1, cantidad: 15 }];
    if (n.includes('bandeja 20')) return [{ productoId: 1, cantidad: 20 }];
    if (n.includes('20 emp + 5 jugos')) return [{ productoId: 1, cantidad: 20 }, { productoId: 5, cantidad: 5 }];
    if (n.includes('30 emp + 8 jugos')) return [{ productoId: 1, cantidad: 30 }, { productoId: 5, cantidad: 8 }];
    if (n.includes('3 salsas')) return [{ productoId: 7, cantidad: 3 }];
    if (n.includes('5 salsas')) return [{ productoId: 7, cantidad: 5 }];
    return [];
  }
}
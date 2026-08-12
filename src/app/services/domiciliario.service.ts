import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService, Pedido } from './supabase';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class DomiciliarioService {
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);

  pedidos = signal<Pedido[]>([]);
  cargando = signal(false);

  // Solo pedidos de HOY asignados a este domiciliario
  pedidosHoy = computed(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return this.pedidos().filter((p) => {
      const f = new Date(p.creado_en);
      f.setHours(0, 0, 0, 0);
      return f.getTime() === hoy.getTime();
    });
  });

  // Solo los que están en camino (pendientes de entregar)
  enCamino = computed(() =>
    this.pedidosHoy().filter((p) => p.estado === 'en_camino'),
  );

  // Los que ya entregó hoy
  entregados = computed(() =>
    this.pedidosHoy().filter((p) => p.estado === 'entregado'),
  );

  // Ganancia del día (suma de domicilios de pedidos entregados)
  gananciaHoy = computed(() =>
    this.entregados().reduce((t, p) => t + Number(p.domicilio), 0),
  );

    // 💵 Total que debe cobrar hoy (pedidos en camino)
  porCobrarHoy = computed(() =>
    this.enCamino().reduce((t, p) => t + Number(p.total), 0),
  );

  async cargarMisPedidos(): Promise<void> {
    const perfil = this.auth.perfil();
    if (!perfil) return;

    this.cargando.set(true);
    const { data, error } = await this.supabase.client
      .from('pedidos')
      .select('*')
      .eq('domiciliario_id', perfil.id)
      .order('creado_en', { ascending: false });

    this.cargando.set(false);

    if (error) {
      console.error('❌ Error al cargar pedidos:', error.message);
      return;
    }

    this.pedidos.set((data as Pedido[]) ?? []);
  }

  async marcarEntregado(id: number): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('pedidos')
      .update({ estado: 'entregado' })
      .eq('id', id);

    if (error) {
      console.error('❌ Error al marcar entregado:', error.message);
      return false;
    }

    this.pedidos.update((lista) =>
      lista.map((p) => (p.id === id ? { ...p, estado: 'entregado' } : p)),
    );

    // 🎁 Otorgar puntos al referidor cuando el domiciliario marca entregado
    await this.supabase.client.rpc('otorgar_puntos_referido', { pedido_id: id });

    return true;
  }

  formatearFecha(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatearPrecio(valor: number): string {
    return '$' + Number(valor).toLocaleString('es-CO');
  }

  linkWhatsApp(telefono: string): string {
    const limpio = telefono.replace(/\D/g, '');
    return `https://wa.me/57${limpio}`;
  }

  linkMapa(pedido: Pedido): string {
    return `https://www.google.com/maps?q=${pedido.lat},${pedido.lng}`;
  }

    // 🗂️ Historial completo de entregas
  historialEntregas = computed(() =>
    this.pedidos().filter((p) => p.estado === 'entregado'),
  );

  // 💰 Ganancia de los últimos 7 días
  gananciaSemana = computed(() => {
    const hace7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.historialEntregas()
      .filter((p) => new Date(p.creado_en).getTime() >= hace7)
      .reduce((t, p) => t + Number(p.domicilio), 0);
  });

  entregasSemana = computed(() => {
    const hace7 = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return this.historialEntregas().filter((p) => new Date(p.creado_en).getTime() >= hace7).length;
  });

}
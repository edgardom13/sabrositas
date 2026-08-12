import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService, Pedido } from './supabase';

export type EstadoPedido = Pedido['estado'];

@Injectable({ providedIn: 'root' })
export class PedidosService {
  private supabase = inject(SupabaseService);

  pedidos = signal<Pedido[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  // ===== Conteos por estado =====
  totalPedidos = computed(() => this.pedidos().length);

  pedidosPendientes = computed(
    () => this.pedidos().filter((p) => p.estado === 'pendiente').length,
  );

  pedidosPreparando = computed(
    () => this.pedidos().filter((p) => p.estado === 'preparando').length,
  );

  pedidosEnCamino = computed(
    () => this.pedidos().filter((p) => p.estado === 'en_camino').length,
  );

  pedidosEntregados = computed(
    () => this.pedidos().filter((p) => p.estado === 'entregado').length,
  );

  pedidosCancelados = computed(
    () => this.pedidos().filter((p) => p.estado === 'cancelado').length,
  );

    // ===== 📅 Pedidos de HOY =====
  private esHoy(iso: string): boolean {
    const f = new Date(iso);
    const ahora = new Date();
    return (
      f.getFullYear() === ahora.getFullYear() &&
      f.getMonth() === ahora.getMonth() &&
      f.getDate() === ahora.getDate()
    );
  }

  // Todos los pedidos creados hoy
  pedidosHoy = computed(() =>
    this.pedidos().filter((p) => this.esHoy(p.creado_en)),
  );

  // Solo los pendientes de hoy (para el badge del sidebar)
  pedidosPendientesHoy = computed(
    () => this.pedidosHoy().filter((p) => p.estado === 'pendiente').length,
  );

  // ===== 💰 Caja (solo pedidos ENTREGADOS) =====

  // Total recogido = productos + domicilios
  totalVendido = computed(() =>
    this.pedidos()
      .filter((p) => p.estado === 'entregado')
      .reduce((total, p) => total + Number(p.total), 0),
  );

  // 💵 Ventas de productos (subtotal - descuento)
  totalVendidoProductos = computed(() =>
    this.pedidos()
      .filter((p) => p.estado === 'entregado')
      .reduce((total, p) => total + (Number(p.subtotal) - Number(p.descuento)), 0),
  );

  // 🛵 Ganancia por domicilios
  totalDomicilios = computed(() =>
    this.pedidos()
      .filter((p) => p.estado === 'entregado')
      .reduce((total, p) => total + Number(p.domicilio), 0),
  );

  // ===== Cargar pedidos =====
  async cargarPedidos(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('pedidos')
      .select('*')
      .order('creado_en', { ascending: false });

    this.cargando.set(false);

    if (error) {
      this.error.set(error.message);
      console.error('❌ Error al cargar pedidos:', error.message);
      return;
    }

    this.pedidos.set((data as Pedido[]) ?? []);
  }

  // ===== Cambiar estado =====
  async cambiarEstado(id: number, nuevoEstado: EstadoPedido): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', id);

    if (error) {
      console.error('❌ Error al cambiar estado:', error.message);
      return false;
    }

    this.pedidos.update((pedidos) =>
      pedidos.map((p) => (p.id === id ? { ...p, estado: nuevoEstado } : p)),
    );
    return true;
  }

  // ===== Marcar como pagado =====
  async marcarComoPagado(id: number, metodoPago: string): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('pedidos')
      .update({ pagado: true, metodo_pago: metodoPago })
      .eq('id', id);

    if (error) {
      console.error('❌ Error al marcar como pagado:', error.message);
      return false;
    }

    this.pedidos.update((pedidos) =>
      pedidos.map((p) =>
        p.id === id ? { ...p, pagado: true, metodo_pago: metodoPago } : p,
      ),
    );
    return true;
  }

  // ===== Nota del administrador =====
  async agregarNota(id: number, nota: string): Promise<boolean> {
    const { error } = await this.supabase.client
      .from('pedidos')
      .update({ notas_admin: nota })
      .eq('id', id);

    if (error) {
      console.error('❌ Error al agregar nota:', error.message);
      return false;
    }

    this.pedidos.update((pedidos) =>
      pedidos.map((p) => (p.id === id ? { ...p, notas_admin: nota } : p)),
    );
    return true;
  }

  // ===== Utilidades =====
  formatearFecha(iso: string): string {
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatearPrecio(valor: number): string {
    return '$' + Number(valor).toLocaleString('es-CO');
  }

  colorEstado(estado: EstadoPedido): string {
    const colores: Record<EstadoPedido, string> = {
      pendiente: '#ffc107',
      preparando: '#17a2b8',
      en_camino: '#007bff',
      entregado: '#28a745',
      cancelado: '#dc3545',
    };
    return colores[estado];
  }

  textoEstado(estado: EstadoPedido): string {
    const textos: Record<EstadoPedido, string> = {
      pendiente: '⏳ Pendiente',
      preparando: '👨‍ Preparando',
      en_camino: '🛵 En camino',
      entregado: '✅ Entregado',
      cancelado: '❌ Cancelado',
    };
    return textos[estado];
  }

    // ===== Agregar pedido en vivo (desde Realtime) sin duplicar =====
  agregarLocal(pedido: Pedido): void {
    this.pedidos.update((lista) => {
      if (lista.some((p) => p.id === pedido.id)) return lista;
      return [pedido, ...lista];
    });
  }
}
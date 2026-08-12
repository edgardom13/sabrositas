import { Injectable, inject, signal, computed } from '@angular/core';
import { SupabaseService, Pedido } from './supabase';

export interface Cliente {
  telefono: string;
  nombre: string;
  apellido: string;
  direccion: string;
  totalPedidos: number;
  gastadoTotal: number;
  primerPedido: string;
  ultimoPedido: string;
  lat: number | null;
  lng: number | null;
}

@Injectable({ providedIn: 'root' })
export class ClientesService {
  private supabase = inject(SupabaseService);

  clientes = signal<Cliente[]>([]);
  cargando = signal(false);
  error = signal<string | null>(null);

  totalClientes = computed(() => this.clientes().length);

  clientesFrecuentes = computed(
    () => this.clientes().filter((c) => c.totalPedidos >= 3).length,
  );

  totalAcumulado = computed(() =>
    this.clientes().reduce((t, c) => t + c.gastadoTotal, 0),
  );

  async cargarClientes(): Promise<void> {
    this.cargando.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase.client
      .from('pedidos')
      .select('*')
      .order('creado_en', { ascending: true });

    this.cargando.set(false);

    if (error) {
      this.error.set(error.message);
      console.error('❌ Error al cargar clientes:', error.message);
      return;
    }

    const pedidos = (data as Pedido[]) ?? [];
    const mapa = new Map<string, Cliente>();

    for (const p of pedidos) {
      const tel = (p.telefono || '').replace(/\D/g, '');
      if (!tel) continue;

      const monto = p.estado === 'entregado' ? Number(p.total) : 0;
      const existente = mapa.get(tel);

      if (!existente) {
        mapa.set(tel, {
          telefono: p.telefono,
          nombre: p.nombre_cliente,
          apellido: p.apellido_cliente,
          direccion: p.direccion,
          totalPedidos: 1,
          gastadoTotal: monto,
          primerPedido: p.creado_en,
          ultimoPedido: p.creado_en,
          lat: p.lat ?? null,
          lng: p.lng ?? null,
        });
      } else {
        existente.totalPedidos += 1;
        existente.gastadoTotal += monto;
        existente.ultimoPedido = p.creado_en;
        existente.direccion = p.direccion;
        if (p.lat && p.lng) {
          existente.lat = p.lat;
          existente.lng = p.lng;
        }
      }
    }

    const lista = Array.from(mapa.values()).sort(
      (a, b) => b.totalPedidos - a.totalPedidos,
    );

    this.clientes.set(lista);
  }

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
}
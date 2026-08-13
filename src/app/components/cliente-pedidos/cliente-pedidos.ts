import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ReferidosService } from '../../services/referidos.service';
import { Pedido } from '../../services/supabase';

@Component({
  selector: 'app-cliente-pedidos',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './cliente-pedidos.html',
})
export class ClientePedidos implements OnInit {
  referidos = inject(ReferidosService);
  pedidoExpandido = signal<number | null>(null);

  ngOnInit(): void {
    this.referidos.cargarMisPedidos();
  }

  formatearPrecio(v: number): string {
    return '$' + Number(v).toLocaleString('es-CO');
  }

  formatearFecha(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatearHora(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  tiempoTranscurrido(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diff / 60000);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.floor(h / 24);
    return `hace ${d} día${d > 1 ? 's' : ''}`;
  }

  alternarDetalle(id: number): void {
    this.pedidoExpandido.update((v) => (v === id ? null : id));
  }

  // ===== Estados con estilo =====
  colorEstado(estado: string): string {
    const c: Record<string, string> = {
      pendiente: '#ffc107',
      preparando: '#17a2b8',
      en_camino: '#007bff',
      entregado: '#28a745',
      cancelado: '#dc3545',
    };
    return c[estado] ?? '#888';
  }

  textoEstado(estado: string): string {
    const t: Record<string, string> = {
      pendiente: '⏳ Recibido',
      preparando: '👨‍🍳 Preparando',
      en_camino: '🛵 En camino',
      entregado: '✅ Entregado',
      cancelado: '❌ Cancelado',
    };
    return t[estado] ?? estado;
  }

  iconoEstado(estado: string): string {
    const i: Record<string, string> = {
      pendiente: '⏳',
      preparando: '👨‍🍳',
      en_camino: '🛵',
      entregado: '✅',
      cancelado: '❌',
    };
    return i[estado] ?? '📦';
  }

  pasoActivo(estado: string): number {
    const pasos: Record<string, number> = {
      pendiente: 0, preparando: 1, en_camino: 2, entregado: 3,
    };
    return pasos[estado] ?? -1;
  }

  emojiProducto(nombre: string): string {
    const n = nombre.toLowerCase();
    if (n.includes('carne')) return '🥩';
    if (n.includes('pollo')) return '🍗';
    if (n.includes('queso')) return '🧀';
    if (n.includes('maíz') || n.includes('maiz')) return '🌽';
    if (n.includes('corozo')) return '🍒';
    if (n.includes('jugo')) return '🍹';
    if (n.includes('salsa')) return '🥫';
    if (n.includes('frío') || n.includes('frio')) return '🧊';
    return '🥟';
  }

  metodoPagoTexto(m: string | null): string {
    const t: Record<string, string> = {
      efectivo: '💵 Efectivo',
      transferencia: '📱 Transferencia',
      nequi: '📲 Nequi',
      datáfono: '💳 Datáfono',
      datafono: '💳 Datáfono',
    };
    return t[(m ?? '').toLowerCase()] ?? '💵 Contra entrega';
  }

  linkMapa(p: Pedido): string {
    return p.lat && p.lng
      ? `https://www.google.com/maps?q=${p.lat},${p.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion)}`;
  }
}
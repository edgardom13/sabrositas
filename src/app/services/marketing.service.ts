import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase';

export interface ClienteWa { telefono: string; nombre: string; pedidos: number; ultimo: string; }

@Injectable({ providedIn: 'root' })
export class MarketingService {
  private supabase = inject(SupabaseService);
  clientes = signal<ClienteWa[]>([]);

  // 📇 Clientes únicos extraídos de los pedidos
  async cargarClientes(): Promise<void> {
    const { data } = await this.supabase.client
      .from('pedidos').select('nombre_cliente, apellido_cliente, telefono, creado_en');
    const mapa = new Map<string, ClienteWa>();
    for (const p of (data as any[]) ?? []) {
      const tel = (p.telefono || '').replace(/\D/g, '');
      if (!tel) continue;
      const actual = mapa.get(tel);
      if (actual) {
        actual.pedidos++;
        if (p.creado_en > actual.ultimo) actual.ultimo = p.creado_en;
      } else {
        mapa.set(tel, {
          telefono: tel,
          nombre: `${p.nombre_cliente} ${p.apellido_cliente}`.trim(),
          pedidos: 1,
          ultimo: p.creado_en,
        });
      }
    }
    this.clientes.set([...mapa.values()].sort((a, b) => b.pedidos - a.pedidos));
  }

  linkWa(telefono: string, mensaje: string): string {
    return `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;
  }

  async guardarCampana(c: { titulo: string; mensaje: string; imagen: string | null; destinatarios: number }): Promise<void> {
    await this.supabase.client.from('campanas').insert([{
      titulo: c.titulo, mensaje: c.mensaje, imagen: c.imagen, destinatarios: c.destinatarios,
    }]);
  }
}
import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ⚠️ Reemplaza con tus claves (Settings → API en Supabase)
const SUPABASE_URL = 'https://vpousfdrqaiqonbnkaeb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb3VzZmRycWFpcW9uYm5rYWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjk3MTEsImV4cCI6MjEwMTk0NTcxMX0.7Cu3iWjy_mF2qJqwuBvumLs-aYSkjtdtee0_Aq3bHrg';

export interface RegistroPedido {
  nombre_cliente: string;
  apellido_cliente: string;
  telefono: string;
  direccion: string;
  items: { nombre: string; cantidad: number; precio: number }[];
  subtotal: number;
  descuento: number;
  domicilio: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  private client: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async registrarPedido(datos: RegistroPedido): Promise<boolean> {
    const { error } = await this.client.from('pedidos').insert([datos]);

    if (error) {
      console.error('❌ Error al guardar el pedido en Supabase:', error.message);
      return false;
    }

    console.log('✅ Pedido guardado en Supabase');
    return true;
  }
}
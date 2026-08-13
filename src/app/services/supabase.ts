import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ⚠️ Reemplaza con tus claves (Settings → API en Supabase)
const SUPABASE_URL = 'https://vpousfdrqaiqonbnkaeb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwb3VzZmRycWFpcW9uYm5rYWViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNjk3MTEsImV4cCI6MjEwMTk0NTcxMX0.7Cu3iWjy_mF2qJqwuBvumLs-aYSkjtdtee0_Aq3bHrg';

// Tipo de datos de un pedido (lo usamos en varios lugares)
export interface Pedido {
  id: number;
  creado_en: string;
  nombre_cliente: string;
  apellido_cliente: string;
  telefono: string;
  direccion: string;
  items: { nombre: string; cantidad: number; precio: number }[];
  subtotal: number;
  descuento: number;
  domicilio: number;
  total: number;
  estado: 'pendiente' | 'preparando' | 'en_camino' | 'entregado' | 'cancelado';
  pagado: boolean;
  metodo_pago: string | null;
  notas_admin: string | null;
  lat: number | null;
  lng: number | null;
  referido_por: string | null;
  domiciliario_id: string | null;
  puntos_otorgado: boolean;
  codigo_canje: string | null;   // ← AGREGADO
}

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
  lat: number | null;
  lng: number | null;
  referido_por?: string | null;
  codigo_canje?: string | null;  // ← AGREGADO
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient;

  constructor() {
    this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }

  async registrarPedido(datos: RegistroPedido): Promise<boolean> {
    const { error } = await this.client.from('pedidos').insert([datos]);
    if (error) {
      console.error('❌ Error al guardar el pedido:', error.message);
      return false;
    }
    console.log('✅ Pedido guardado en Supabase');
    return true;
  }
}
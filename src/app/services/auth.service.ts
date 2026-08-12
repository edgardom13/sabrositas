import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase';
import type { User } from '@supabase/supabase-js';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  // Estado reactivo del usuario
  usuario = signal<User | null>(null);
  cargando = signal(true);

  constructor() {
    this.inicializarSesion();
  }

  private inicializarSesion(): void {
    // Al iniciar, consulta si hay una sesión activa
    this.supabase.client.auth.getSession().then(({ data }) => {
      this.usuario.set(data.session?.user ?? null);
      this.cargando.set(false);
    });

    // Escucha cambios de autenticación (login/logout)
    this.supabase.client.auth.onAuthStateChange((_evento, sesion) => {
      this.usuario.set(sesion?.user ?? null);
    });
  }

  // Consulta la sesión real contra Supabase (seguridad robusta)
async verificarSesion(): Promise<boolean> {
  const { data } = await this.supabase.client.auth.getSession();
  const user = data.session?.user ?? null;
  this.usuario.set(user);
  return user !== null;
}

  async iniciarSesion(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    this.cargando.set(true);
    const { data, error } = await this.supabase.client.auth.signInWithPassword({
      email,
      password,
    });

    this.cargando.set(false);

    if (error) {
      return { ok: false, error: this.traducirError(error.message) };
    }

    this.usuario.set(data.user);
    this.router.navigate(['/dashboard/pedidos']);
    return { ok: true };
  }

  async cerrarSesion(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.usuario.set(null);
    this.router.navigate(['/admin']);
  }

  estaAutenticado(): boolean {
    return this.usuario() !== null;
  }

  private traducirError(mensaje: string): string {
    const traducciones: Record<string, string> = {
      'Invalid login credentials': 'Correo o contraseña incorrectos',
      'Email not confirmed': 'El correo no está verificado',
      'Too many requests': 'Demasiados intentos. Intenta en unos minutos',
    };
    return traducciones[mensaje] ?? 'Error al iniciar sesión';
  }
}
import { Injectable, inject, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from './supabase';
import type { User } from '@supabase/supabase-js';

export type Rol = 'admin' | 'inversor' | 'domiciliario' | 'cliente';

export interface Perfil {
  id: string;
  rol: Rol;
  nombre: string | null;
  telefono: string | null;
  codigo_referido: string | null;
  puntos: number;
  permisos?: Record<string, { ver: boolean; editar: boolean }>;  // ← NUEVO
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private router = inject(Router);

  usuario = signal<User | null>(null);
  perfil = signal<Perfil | null>(null);
  cargando = signal(true);

  rol = computed(() => this.perfil()?.rol ?? null);

  constructor() {
    this.inicializarSesion();
  }

  private inicializarSesion(): void {
    this.supabase.client.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user ?? null;
      this.usuario.set(user);
      if (user) await this.cargarPerfil();
      this.cargando.set(false);
    });

    this.supabase.client.auth.onAuthStateChange(async (_evento, sesion) => {
      const user = sesion?.user ?? null;
      this.usuario.set(user);
      if (user) await this.cargarPerfil();
      else this.perfil.set(null);
    });
  }

  // Lee el perfil (rol, puntos, código) del usuario autenticado
  async cargarPerfil(): Promise<void> {
    const user = this.usuario();
    if (!user) {
      this.perfil.set(null);
      return;
    }
    const { data } = await this.supabase.client
      .from('perfiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    this.perfil.set((data as Perfil) ?? null);
  }

  async iniciarSesion(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    this.cargando.set(true);
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    this.cargando.set(false);

    if (error) return { ok: false, error: this.traducirError(error.message) };

    this.usuario.set(data.user);
    await this.cargarPerfil();

    // 🛡️ Si la cuenta no tiene perfil legible, no deambules: avisa
    if (!this.perfil()) {
      await this.cerrarSesion();
      return {
        ok: false,
        error: 'Tu cuenta no tiene un perfil asignado. Contacta al administrador.',
      };
    }

    // Cada rol va a SU panel
    this.router.navigate([this.rutaPorRol()]);
    return { ok: true };
  }

  async cerrarSesion(): Promise<void> {
    await this.supabase.client.auth.signOut();
    this.usuario.set(null);
    this.perfil.set(null);
    this.router.navigate(['/admin']);
  }

  async verificarSesion(): Promise<boolean> {
    const { data } = await this.supabase.client.auth.getSession();
    const user = data.session?.user ?? null;
    this.usuario.set(user);
    if (user) await this.cargarPerfil();
    else this.perfil.set(null);
    return user !== null;
  }

  estaAutenticado(): boolean {
    return this.usuario() !== null;
  }

  // Cada rol tiene su ruta
  rutaPorRol(): string {
  switch (this.rol()) {
    case 'admin':
    case 'inversor':
      return '/dashboard/pedidos';
    case 'domiciliario':
      return '/panel-domiciliario';
    case 'cliente':
      return '/panel-cliente';
    default:
      return '/admin';
  }
}

  private traducirError(mensaje: string): string {
    const traducciones: Record<string, string> = {
      'Invalid login credentials': 'Correo o contraseña incorrectos',
      'Email not confirmed': 'El correo no está verificado',
      'Too many requests': 'Demasiados intentos. Intenta en unos minutos',
    };
    return traducciones[mensaje] ?? 'Error al iniciar sesión';
  }


    // ===== Registro con rol elegido + redirección a /confirmado =====
  async registrarse(
    nombre: string,
    telefono: string,
    email: string,
    password: string,
    rol: 'cliente' | 'domiciliario',
  ): Promise<{ ok: boolean; error?: string }> {
    const { error } = await this.supabase.client.auth.signUp({
      email,
      password,
      options: {
        data: { nombre, telefono, rol },
        emailRedirectTo: `${window.location.origin}/confirmado`, // ← link del correo va a NUESTRA página
      },
    });

    if (error) return { ok: false, error: this.traducirError(error.message) };

    // Con confirmación activada, el usuario debe abrir el correo
    return { ok: true };
  }

}
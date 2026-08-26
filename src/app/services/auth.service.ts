import { Injectable, inject, signal, computed, NgZone } from '@angular/core';
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
  permisos?: Record<string, { ver: boolean; editar: boolean }>;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private router = inject(Router);
  private ngZone = inject(NgZone);

  usuario = signal<User | null>(null);
  perfil = signal<Perfil | null>(null);
  cargando = signal(true);

  rol = computed(() => this.perfil()?.rol ?? null);

  // ✅ Se resuelve cuando la sesión inicial está lista (los guards lo esperan)
  private resolverLista!: () => void;
  readonly sesionLista = new Promise<void>((resolve) => (this.resolverLista = resolve));

  constructor() {
    this.inicializarSesion();
  }

  private inicializarSesion(): void {
    // Sesión inicial al cargar la app
    this.supabase.client.auth
      .getSession()
      .then(async ({ data }) => {
        const user = data.session?.user ?? null;
        this.usuario.set(user);
        if (user) await this.cargarPerfil();
        this.cargando.set(false);
        this.resolverLista();
      })
      .catch(() => {
        this.cargando.set(false);
        this.resolverLista();
      });

    // ⚠️ NUNCA hagas await de Supabase dentro de este callback (deadlock).
    // Lo diferimos con setTimeout para liberar el lock interno de Supabase.
    this.supabase.client.auth.onAuthStateChange((_evento, sesion) => {
      setTimeout(() => {
        this.ngZone.run(async () => {
          const user = sesion?.user ?? null;
          this.usuario.set(user);
          if (user) await this.cargarPerfil();
          else this.perfil.set(null);
        });
      }, 0);
    });
  }

  // Lee el perfil (rol, puntos, código, permisos) del usuario autenticado
  async cargarPerfil(): Promise<void> {
    const user = this.usuario();
    if (!user) {
      this.perfil.set(null);
      return;
    }
    try {
      const { data, error } = await this.supabase.client
        .from('perfiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('⚠️ Error cargando perfil:', error.message);
        return;
      }
      this.perfil.set((data as Perfil) ?? null);
    } catch (e) {
      console.error('⚠️ Excepción cargando perfil:', e);
    }
  }

  async iniciarSesion(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
    this.cargando.set(true);
    const { data, error } = await this.supabase.client.auth.signInWithPassword({ email, password });
    this.cargando.set(false);

    if (error) return { ok: false, error: this.traducirError(error.message) };

    this.usuario.set(data.user);
    await this.cargarPerfil();

    if (!this.perfil()) {
      await this.cerrarSesion();
      return { ok: false, error: 'Tu cuenta no tiene un perfil asignado. Contacta al administrador.' };
    }

    this.router.navigate([this.rutaPorRol()]);
    return { ok: true };
  }

  async cerrarSesion(): Promise<void> {
    // 'local' → cierra solo este dispositivo, no tumba los demás
    await this.supabase.client.auth.signOut({ scope: 'local' });
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

  async refrescarSesion(): Promise<boolean> {
    const { data, error } = await this.supabase.client.auth.refreshSession();
    if (error || !data.session) return false;
    this.usuario.set(data.session.user);
    await this.cargarPerfil();
    return true;
  }

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
        emailRedirectTo: `${window.location.origin}/confirmado`,
      },
    });
    if (error) return { ok: false, error: this.traducirError(error.message) };
    return { ok: true };
  }
}
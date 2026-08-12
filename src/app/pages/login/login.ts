import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router'; // ← agrega RouterLink
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink], // ← agrégalo aquí
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  rolPagina: string = this.route.snapshot.data['rolPagina'] ?? 'admin';

  // ️ Identificador visible de cada programa
  titulos: Record<string, { titulo: string; sub: string; badge: string }> = {
    admin: {
      titulo: 'SABROSITAS',
      sub: 'Panel Administrativo',
      badge: '🔐 Acceso administrativo',
    },
    domiciliario: {
      titulo: 'SABROSITAS',
      sub: 'Panel Domicilios 🛵',
      badge: '🛵 Programa Domicilios',
    },
    cliente: {
      titulo: 'SABROSITAS',
      sub: 'Mi Cuenta · Referidos 🎁',
      badge: '🎁 Programa Referidos',
    },
  };

  modoRegistro = signal(false);

  nombre = '';
  telefono = '';
  email = '';
  password = '';
  mostrarPassword = signal(false);
  enviando = signal(false);
  error = signal<string | null>(null);

  async iniciarSesion(): Promise<void> {
    if (!this.email.trim() || !this.password.trim()) {
      this.error.set('Por favor completa todos los campos');
      return;
    }

    this.error.set(null);
    this.enviando.set(true);
    const resultado = await this.auth.iniciarSesion(this.email.trim(), this.password);
    this.enviando.set(false);
    if (!resultado.ok) this.error.set(resultado.error ?? 'Error al iniciar sesión');
  }

  async registrarse(): Promise<void> {
    if (!this.nombre.trim() || !this.telefono.trim() || !this.email.trim() || !this.password.trim()) {
      this.error.set('Por favor completa todos los campos');
      return;
    }
    if (this.password.length < 6) {
      this.error.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    this.error.set(null);
    this.enviando.set(true);

    // 🎯 El rol depende de la página de login donde estés
    const rol = this.rolPagina === 'domiciliario' ? 'domiciliario' : 'cliente';

    const resultado = await this.auth.registrarse(
      this.nombre.trim(),
      this.telefono.trim(),
      this.email.trim(),
      this.password,
      rol,
    );

    this.enviando.set(false);
    if (!resultado.ok) this.error.set(resultado.error ?? 'Error al registrarte');
  }

  alternarPassword(): void {
    this.mostrarPassword.update((v) => !v);
  }

  get info() {
    return this.titulos[this.rolPagina] ?? this.titulos['admin'];
  }
}
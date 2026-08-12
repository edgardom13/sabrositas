import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(AuthService);

  email = '';
  password = '';
  mostrarPassword = signal(false);
  enviando = signal(false);
  error = signal<string | null>(null);

  async iniciarSesion(): Promise<void> {
    // Validaciones
    if (!this.email.trim() || !this.password.trim()) {
      this.error.set('Por favor completa todos los campos');
      return;
    }

    if (!this.email.includes('@')) {
      this.error.set('Ingresa un correo válido');
      return;
    }

    this.error.set(null);
    this.enviando.set(true);

    const resultado = await this.auth.iniciarSesion(
      this.email.trim(),
      this.password,
    );

    this.enviando.set(false);

    if (!resultado.ok) {
      this.error.set(resultado.error ?? 'Error al iniciar sesión');
    }
  }

  alternarPassword(): void {
    this.mostrarPassword.update((v) => !v);
  }
}
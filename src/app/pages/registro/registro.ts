import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './registro.html',
  styleUrls: ['../../styles/landing.css', './registro.css'],
})
export class Registro {
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);

  rolElegido = signal<'cliente' | 'domiciliario'>(
    this.route.snapshot.queryParams['rol'] === 'domiciliario' ? 'domiciliario' : 'cliente',
  );

  nombre = '';
  telefono = '';
  email = '';
  password = '';
  confirmar = '';
  enviando = signal(false);
  enviado = signal(false);
  error = signal<string | null>(null);

  elegirRol(rol: 'cliente' | 'domiciliario'): void {
    this.rolElegido.set(rol);
  }

  async registrarse(): Promise<void> {
    if (!this.nombre.trim() || !this.telefono.trim() || !this.email.trim() || !this.password.trim()) {
      this.error.set('Completa todos los campos');
      return;
    }
    if (!this.email.includes('@')) { this.error.set('Ingresa un correo válido'); return; }
    if (this.password.length < 6) { this.error.set('La contraseña debe tener al menos 6 caracteres'); return; }
    if (this.password !== this.confirmar) { this.error.set('Las contraseñas no coinciden'); return; }

    this.error.set(null);
    this.enviando.set(true);
    const r = await this.auth.registrarse(
      this.nombre.trim(), this.telefono.trim(), this.email.trim(), this.password, this.rolElegido(),
    );
    this.enviando.set(false);

    if (!r.ok) { this.error.set(r.error ?? 'Error al registrarte'); return; }
    this.enviado.set(true);
  }
}
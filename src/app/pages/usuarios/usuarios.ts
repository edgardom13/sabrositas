import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComunidadService } from '../../services/comunidad.service';

@Component({
  selector: 'app-usuarios-admin',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './usuarios.html',
  styleUrls: ['../../styles/admin-comun.css'],
})
export class UsuariosAdmin implements OnInit {
  service = inject(ComunidadService);
  mensaje = signal<string | null>(null);
  creando = signal(false);
  filtroRol = signal<'todos' | 'admin' | 'domiciliario' | 'cliente'>('todos');

  nombre = signal('');
  telefono = signal('');
  email = signal('');
  password = signal('');
  rol = signal<'domiciliario' | 'cliente'>('domiciliario');

  ngOnInit(): void {
    this.service.cargarTodo();
  }

  lista = computed(() => {
    const f = this.filtroRol();
    return f === 'todos'
      ? this.service.perfiles()
      : this.service.perfiles().filter((p) => p.rol === f);
  });

  async crear(): Promise<void> {
    if (!this.nombre().trim() || !this.email().includes('@') || this.password().length < 6) {
      this.mostrarMensaje('⚠️ Nombre, correo válido y contraseña mín. 6 caracteres');
      return;
    }
    this.creando.set(true);
    const r = await this.service.crearUsuario({
      email: this.email().trim(),
      password: this.password(),
      nombre: this.nombre().trim(),
      telefono: this.telefono().trim(),
      rol: this.rol(),
    });
    this.creando.set(false);

    if (r.ok) {
      this.mostrarMensaje('✅ Usuario creado y listo para ingresar');
      this.nombre.set(''); this.telefono.set(''); this.email.set(''); this.password.set('');
    } else {
      this.mostrarMensaje('⚠️ ' + (r.error ?? 'Error al crear el usuario'));
    }
  }

  async ajustarPuntos(id: string, actual: number, nombre: string): Promise<void> {
    const valor = prompt(`Nuevos puntos para ${nombre}:`, String(actual));
    if (valor === null) return;
    const ok = await this.service.ajustarPuntos(id, Math.max(0, Number(valor) || 0), actual);
    if (ok) this.mostrarMensaje('⭐ Puntos actualizados');
  }

  colorRol(rol: string): string {
    const c: Record<string, string> = { admin: '#ffc107', domiciliario: '#007bff', cliente: '#28a745' };
    return c[rol] ?? '#888';
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
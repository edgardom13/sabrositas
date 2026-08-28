import { Component, inject, computed } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Tema } from '../../services/tema';
import { AdminPos } from '../admin-pos/admin-pos';

@Component({
  selector: 'app-empleado-dashboard',
  standalone: true,
  imports: [AdminPos],
  templateUrl: './empleado-dashboard.html',
  styleUrl: './empleado-dashboard.css',
})
export class EmpleadoDashboard {
  private auth = inject(AuthService);
  tema = inject(Tema);

  emailUsuario = computed(() => this.auth.usuario()?.email ?? 'empleado@sabrositas.com');
  inicialUsuario = computed(() => this.emailUsuario().charAt(0).toUpperCase() || 'E');

  alternarTema(): void {
    this.tema.alternar();
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
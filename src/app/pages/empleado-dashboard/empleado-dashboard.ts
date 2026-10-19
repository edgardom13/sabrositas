import { Component, inject, computed, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Tema } from '../../services/tema';
import { AdminPos } from '../admin-pos/admin-pos';
import { Pedidos } from '../pedidos/pedidos'; // ⚠️ Ajusta esta ruta si tu componente de pedidos está en otra ubicación

type VistaEmpleado = 'pos' | 'pedidos';

@Component({
  selector: 'app-empleado-dashboard',
  standalone: true,
  imports: [AdminPos, Pedidos],
  templateUrl: './empleado-dashboard.html',
  styleUrl: './empleado-dashboard.css',
})
export class EmpleadoDashboard {
  private auth = inject(AuthService);
  tema = inject(Tema);

  vista = signal<VistaEmpleado>('pos');
  sidebarAbierto = signal(false);

  emailUsuario = computed(() => this.auth.usuario()?.email ?? 'empleado@sabrositas.com');
  inicialUsuario = computed(() => this.emailUsuario().charAt(0).toUpperCase() || 'E');

  alternarTema(): void {
    this.tema.alternar();
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }

  cambiarVista(v: VistaEmpleado): void {
    this.vista.set(v);
    this.sidebarAbierto.set(false); // cierra sidebar móvil
  }

  toggleSidebar(): void {
    this.sidebarAbierto.update((v) => !v);
  }
}
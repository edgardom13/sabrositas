import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Horario } from '../../services/horario';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-admin-cierre',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-cierre.html',
  styleUrl: './admin-cierre.css',
})
export class AdminCierre implements OnInit {
  horario = inject(Horario);
  config = inject(ConfigService);

  guardando = signal(false);
  mensaje = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.config.cargar();
  }

  async alternar(): Promise<void> {
    this.guardando.set(true);
    let ok: boolean;
    if (this.horario.cerradoManual()) {
      ok = await this.horario.abrirAhora();
      this.mostrarMensaje(ok ? '🔓 Tienda ABIERTA manualmente' : '❌ Error al abrir');
    } else {
      ok = await this.horario.cerrarAhora();
      this.mostrarMensaje(ok ? '🔒 Tienda CERRADA manualmente' : '❌ Error al cerrar');
    }
    this.guardando.set(false);
  }

  private mostrarMensaje(t: string): void {
    this.mensaje.set(t);
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
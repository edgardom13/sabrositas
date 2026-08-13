import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ComunidadService } from '../../services/comunidad.service';

@Component({
  selector: 'app-referidos-admin',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './referidos.html',
  styleUrls: ['../../styles/admin-comun.css'],
})
export class ReferidosAdmin implements OnInit {
  service = inject(ComunidadService);
  mensaje = signal<string | null>(null);
  procesando = signal<number | null>(null);

  nombrePremio = signal('');
  puntosPremio = signal(0);

  ngOnInit(): void {
    this.service.cargarTodo();
  }

  stats = computed(() => ({
    puntosCirculacion: this.service.perfiles().reduce((t, p) => t + (p.puntos || 0), 0),
    pedidosReferidos: this.service.pedidosReferidos().length,
    canjesPendientes: this.service.canjes().filter((c) => c.estado === 'pendiente').length,
    premiosActivos: this.service.premios().filter((p) => p.activo).length,
  }));

  ranking = computed(() => {
    const pedidos = this.service.pedidosReferidos();
    return this.service.perfiles()
      .filter((p) => p.codigo_referido)
      .map((p) => ({
        perfil: p,
        referidos: pedidos.filter((pd) => pd.referido_por === p.codigo_referido).length,
      }))
      .sort((a, b) => b.perfil.puntos - a.perfil.puntos || b.referidos - a.referidos)
      .slice(0, 10);
  });

  async estadoCanje(id: number, estado: 'reclamado' | 'anulado'): Promise<void> {
    this.procesando.set(id);
    const ok = await this.service.estadoCanje(id, estado);
    this.procesando.set(null);
    if (ok) this.mostrarMensaje(estado === 'reclamado' ? '✅ Canje reclamado' : '🚫 Canje anulado');
  }

  async crearPremio(): Promise<void> {
    if (!this.nombrePremio().trim() || this.puntosPremio() <= 0) {
      this.mostrarMensaje('⚠️ Nombre y puntos mayores a 0');
      return;
    }
    const ok = await this.service.guardarPremio({
      nombre: this.nombrePremio().trim(),
      puntos: this.puntosPremio(),
    });
    if (ok) {
      this.nombrePremio.set('');
      this.puntosPremio.set(0);
      this.mostrarMensaje('🏆 Premio creado');
    }
  }

  async togglePremio(id: number, activo: boolean): Promise<void> {
    const ok = await this.service.guardarPremio({ id, activo: !activo });
    if (ok) this.mostrarMensaje(activo ? '⏸️ Premio desactivado' : '▶️ Premio activado');
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
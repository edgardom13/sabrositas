import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ReferidosService } from '../../services/referidos.service';

@Component({
  selector: 'app-cliente-puntos',
  standalone: true,
  imports: [],
  templateUrl: './cliente-puntos.html',
})
export class ClientePuntos implements OnInit {
  auth = inject(AuthService);
  referidos = inject(ReferidosService);
  copiado = signal(false);

  stats = computed(() => {
    const pedidos = this.referidos.misPedidos();
    const movs = this.referidos.movimientos();
    return {
      totalPedidos: pedidos.length,
      entregados: pedidos.filter((p) => p.estado === 'entregado').length,
      gastado: pedidos.filter((p) => p.estado === 'entregado').reduce((t, p) => t + Number(p.total || 0), 0),
      referidosExitosos: movs.filter((m) => m.concepto.includes('referido')).length,
    };
  });

  siguientePremio = computed(() => {
    const pts = this.auth.perfil()?.puntos ?? 0;
    return this.referidos.premios().filter((p) => p.puntos > pts).sort((a, b) => a.puntos - b.puntos)[0] ?? null;
  });

  progresoSiguiente = computed(() => {
    const pts = this.auth.perfil()?.puntos ?? 0;
    const sp = this.siguientePremio();
    return sp ? Math.min(100, Math.round((pts / sp.puntos) * 100)) : 100;
  });

  ngOnInit(): void {
    this.referidos.cargarPremios();
    this.referidos.cargarMisPedidos();
    this.referidos.cargarMovimientos();
  }

  formatearPrecio(v: number): string { return '$' + v.toLocaleString('es-CO'); }

  linkCompartir(): string {
    const texto = `🥟 ¡Te invito a Sabrositas! Pide con mi link y me ayudas a ganar premios gratis: ${this.referidos.linkReferido()}`;
    return `https://wa.me/?text=${encodeURIComponent(texto)}`;
  }

  async copiarLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.referidos.linkReferido());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {}
  }
}
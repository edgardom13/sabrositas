import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { ReferidosService, Premio } from '../../services/referidos.service';
import { Tema } from '../../services/tema';

@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [DatePipe],
  templateUrl: './panel-cliente.html',
  styleUrls: ['../../styles/panel-base.css'],
})
export class PanelCliente implements OnInit {
  auth = inject(AuthService);
  referidos = inject(ReferidosService);
  tema = inject(Tema);

  menuAbierto = signal(false);
  tab = signal<'puntos' | 'pedidos' | 'premios'>('puntos');
  copiado = signal(false);
  procesando = signal<number | null>(null);
  mensaje = signal<string | null>(null);

  ngOnInit(): void {
    this.referidos.cargarPremios();
    this.referidos.cargarCanjes();
    this.referidos.cargarMisPedidos();
  }

  cambiarTab(t: 'puntos' | 'pedidos' | 'premios'): void {
    this.tab.set(t);
    this.menuAbierto.set(false);
  }

  get tituloTab(): string {
    return { puntos: 'Mis puntos', pedidos: 'Mis pedidos', premios: 'Premios y canjes' }[this.tab()];
  }

  inicialNombre(): string {
    return (this.auth.perfil()?.nombre ?? 'C').charAt(0).toUpperCase();
  }

    pasoActivo(estado: string): number {
    const pasos: Record<string, number> = {
      pendiente: 0,
      preparando: 1,
      en_camino: 2,
      entregado: 3,
    };
    return pasos[estado] ?? -1;
  }

  async copiarLink(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.referidos.linkReferido());
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 2000);
    } catch {
      this.mostrarMensaje('⚠️ No se pudo copiar');
    }
  }

  async canjear(premio: Premio): Promise<void> {
    this.procesando.set(premio.id);
    const r = await this.referidos.canjear(premio);
    this.procesando.set(null);
    this.mostrarMensaje(r.ok ? '🎉 ¡Canje exitoso! Muestra tu código al pedir.' : `⚠️ ${r.error}`);
  }

  alternarTema(): void { this.tema.alternar(); }
  cerrarSesion(): void { this.auth.cerrarSesion(); }

  private mostrarMensaje(t: string): void {
    this.mensaje.set(t);
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { DomiciliarioService } from '../../services/domiciliario.service';
import { Tema } from '../../services/tema';
import { Pedido } from '../../services/supabase';

@Component({
  selector: 'app-panel-domiciliario',
  standalone: true,
  imports: [],
  templateUrl: './panel-domiciliario.html',
  styleUrls: ['../../styles/panel-base.css', './panel-domiciliario.css'],
})
export class PanelDomiciliario implements OnInit, OnDestroy {
  auth = inject(AuthService);
  service = inject(DomiciliarioService);
  tema = inject(Tema);

  menuAbierto = signal(false);
  tab = signal<'hoy' | 'historial' | 'ganancias'>('hoy');
  pedidoExpandido = signal<number | null>(null);
  procesando = signal<number | null>(null);
  mensaje = signal<string | null>(null);

  private intervalo?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.service.cargarMisPedidos();
    this.intervalo = setInterval(() => this.service.cargarMisPedidos(), 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  cambiarTab(t: 'hoy' | 'historial' | 'ganancias'): void {
    this.tab.set(t);
    this.menuAbierto.set(false);
  }

  get tituloTab(): string {
    return { hoy: 'Entregas de hoy', historial: 'Historial', ganancias: 'Mis ganancias' }[this.tab()];
  }

  inicialNombre(): string {
    return (this.auth.perfil()?.nombre ?? 'D').charAt(0).toUpperCase();
  }

  alternarDetalle(id: number): void {
    this.pedidoExpandido.update((v) => (v === id ? null : id));
  }

  async marcarEntregado(pedido: Pedido): Promise<void> {
    this.procesando.set(pedido.id);
    const ok = await this.service.marcarEntregado(pedido.id);
    this.procesando.set(null);
    if (ok) this.mostrarMensaje(`✅ Pedido #${pedido.id} entregado. ¡Buen trabajo!`);
  }

  colorEstado(estado: string): string {
    const c: Record<string, string> = {
      pendiente: '#ffc107',
      preparando: '#17a2b8',
      en_camino: '#007bff',
      entregado: '#28a745',
      cancelado: '#dc3545',
    };
    return c[estado] ?? '#888';
  }

  textoEstado(estado: string): string {
    const t: Record<string, string> = {
      pendiente: '⏳ Pendiente',
      preparando: '👨‍ Preparando',
      en_camino: '🛵 En camino',
      entregado: '✅ Entregado',
      cancelado: '❌ Cancelado',
    };
    return t[estado] ?? estado;
  }

  alternarTema(): void { this.tema.alternar(); }
  cerrarSesion(): void { this.auth.cerrarSesion(); }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
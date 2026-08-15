import { Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ReferidosService } from '../../services/referidos.service';
import { Tema } from '../../services/tema';
import { ClientePuntos } from '../../components/cliente-puntos/cliente-puntos';
import { ClientePedidos } from '../../components/cliente-pedidos/cliente-pedidos';
import { ClientePremios } from '../../components/cliente-premios/cliente-premios';
import { MensajesCliente } from '../../components/mensajes-cliente/mensajes-cliente';

type TabId = 'puntos' | 'pedidos' | 'premios' | 'mensajes';

@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [ClientePuntos, ClientePedidos, ClientePremios, MensajesCliente],
  encapsulation: ViewEncapsulation.None,
  templateUrl: './panel-cliente.html',
  styleUrls: ['../../styles/panel-base.css', './panel-cliente.css'],
})
export class PanelCliente implements OnInit {
  auth = inject(AuthService);
  referidos = inject(ReferidosService);
  tema = inject(Tema);

  menuAbierto = signal(false);
  tab = signal<TabId>('puntos');

  async ngOnInit(): Promise<void> {
    await this.auth.cargarPerfil();
    await this.referidos.asegurarCodigo();
  }

  cambiarTab(t: TabId): void {
    this.tab.set(t);
    this.menuAbierto.set(false);
  }

  get tituloTab(): string {
    const mapa: Record<TabId, string> = {
      puntos: 'Mis puntos',
      pedidos: 'Mis pedidos',
      premios: 'Premios y canjes',
      mensajes: 'Invita amigos',
    };
    return mapa[this.tab()];
  }

  inicialNombre(): string {
    return (this.auth.perfil()?.nombre ?? 'C').charAt(0).toUpperCase();
  }

  alternarTema(): void { this.tema.alternar(); }
  cerrarSesion(): void { this.auth.cerrarSesion(); }
}


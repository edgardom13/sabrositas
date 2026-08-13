import { Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { ReferidosService } from '../../services/referidos.service';
import { Tema } from '../../services/tema';
import { ClientePuntos } from '../../components/cliente-puntos/cliente-puntos';
import { ClientePedidos } from '../../components/cliente-pedidos/cliente-pedidos';
import { ClientePremios } from '../../components/cliente-premios/cliente-premios';

@Component({
  selector: 'app-panel-cliente',
  standalone: true,
  imports: [ClientePuntos, ClientePedidos, ClientePremios],
  encapsulation: ViewEncapsulation.None, // ← clave: el CSS aplica a los hijos
  templateUrl: './panel-cliente.html',
  styleUrls: ['../../styles/panel-base.css', './panel-cliente.css'],
})
export class PanelCliente implements OnInit {
  auth = inject(AuthService);
  referidos = inject(ReferidosService);
  tema = inject(Tema);

  menuAbierto = signal(false);
  tab = signal<'puntos' | 'pedidos' | 'premios'>('puntos');

  async ngOnInit(): Promise<void> {
    await this.auth.cargarPerfil();
    await this.referidos.asegurarCodigo();
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

  alternarTema(): void { this.tema.alternar(); }
  cerrarSesion(): void { this.auth.cerrarSesion(); }
}
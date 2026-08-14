import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PedidosService } from '../../services/pedidos.service';
import { NotificacionesService } from '../../services/notificaciones.service';
import { Tema } from '../../services/tema';
import { EgresosService } from '../../services/egresos.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  pedidosService = inject(PedidosService);
  notificaciones = inject(NotificacionesService);
  tema = inject(Tema);
  egresosService = inject(EgresosService);

  menuAbierto = signal(false);
  tituloRuta = signal('Gestión de Pedidos');

  emailUsuario = computed(() => this.auth.usuario()?.email ?? 'admin@sabrositas.com');

  inicialUsuario = computed(() =>
    this.emailUsuario().charAt(0).toUpperCase() || 'A',
  );

    private hoyLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }


  ngOnInit(): void {
    this.pedidosService.cargarPedidos();
    this.notificaciones.iniciar(); // 🔔 escucha pedidos en vivo
    this.egresosService.cargar(this.hoyLocal());

    this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        if (evento.url.includes('pedidos')) {
          this.tituloRuta.set('Gestión de Pedidos');
        } else if (evento.url.includes('clientes')) {
          this.tituloRuta.set('Clientes');
        } else if (evento.url.includes('estadisticas')) {
          this.tituloRuta.set('Estadísticas');
        } else if (evento.url.includes('productos')) {
          this.tituloRuta.set('Gestión de Productos');
        } else if (evento.url.includes('ajustes')) {
          this.tituloRuta.set('Ajustes');
        } else if (evento.url.includes('referidos')) {
          this.tituloRuta.set('Referidos y Canjes');
        } else if (evento.url.includes('usuarios')) {
          this.tituloRuta.set('Usuarios');
        } else {
          this.tituloRuta.set('Panel de Control');
        }
        this.cerrarMenu();
      }
    });
  }

  ngOnDestroy(): void {
    this.notificaciones.detener();
  }

  alternarMenu(): void {
    this.menuAbierto.update((v) => !v);
  }

  cerrarMenu(): void {
    this.menuAbierto.set(false);
  }

  alternarTema(): void {
    this.tema.alternar();
  }

  cerrarSesion(): void {
    this.auth.cerrarSesion();
  }
}
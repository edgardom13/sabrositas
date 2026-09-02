import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, NavigationEnd } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { PedidosService } from '../../services/pedidos.service';
import { NotificacionesService } from '../../services/notificaciones.service';
import { Tema } from '../../services/tema';
import { EgresosService } from '../../services/egresos.service';
import { PermisosService, Modulo } from '../../services/permisos.service';

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
  permisos = inject(PermisosService);  // ← NUEVO

  menuAbierto = signal(false);
  tituloRuta = signal('Panel de Control');

  emailUsuario = computed(() => this.auth.usuario()?.email ?? 'admin@sabrositas.com');
  inicialUsuario = computed(() => this.emailUsuario().charAt(0).toUpperCase() || 'A');

  nombreRol = computed(() => {
    const map: Record<string, string> = {
      admin: 'Administrador',
      inversor: 'Inversionista',
      domiciliario: 'Domiciliario',
      cliente: 'Cliente',
    };
    return map[this.auth.rol() ?? ''] ?? 'Usuario';
  });

  // ===== DROPDOWNS (ahora con módulo para filtrar) =====
  gruposAbiertos = signal<Set<string>>(new Set(['catalogo']));

  gruposSidebar = [
    {
      id: 'catalogo',
      icono: '🍽️',
      nombre: 'Catálogo',
      items: [
        { ruta: 'productos', icono: '🍽️', nombre: 'Productos', modulo: 'catalogo' as Modulo },
        { ruta: 'promociones', icono: '🏷️', nombre: 'Promociones', modulo: 'promociones' as Modulo },
      ],
    },
    {
      id: 'marketing',
      icono: '📣',
      nombre: 'Marketing',
      items: [
        { ruta: 'marketing', icono: '📣', nombre: 'Mensajes', modulo: 'marketing' as Modulo },
        { ruta: 'referidos', icono: '🎁', nombre: 'Referidos', modulo: 'referidos' as Modulo },
        { ruta: 'clientes', icono: '👥', nombre: 'Clientes', modulo: 'clientes' as Modulo },
      ],
    },
    {
      id: 'reportes',
      icono: '📊',
      nombre: 'Reportes',
      items: [
        { ruta: 'estadisticas', icono: '📊', nombre: 'Estadísticas', modulo: 'reportes' as Modulo },
        { ruta: 'reporte-productos', icono: '📦', nombre: 'Productos entregados', modulo: 'reportes' as Modulo },
        { ruta: 'egresos', icono: '💸', nombre: 'Egresos', modulo: 'egresos' as Modulo },
        { ruta: 'predictivo', icono: '📈', nombre: 'Análisis Predictivo', modulo: 'reportes' as Modulo },
      ],
    },
    {
      id: 'admin',
      icono: '💼',
      nombre: 'Administración',
      items: [
        { ruta: 'inversor', icono: '💼', nombre: 'Inversor', modulo: 'inversor' as Modulo },
        { ruta: 'empleados', icono: '👥', nombre: 'Empleados', modulo: 'empleados' as Modulo },
        { ruta: 'usuarios', icono: '👥', nombre: 'Usuarios', modulo: 'usuarios' as Modulo },
      ],
    },
    {
      id: 'sistema',
      icono: '⚙️',
      nombre: 'Sistema',
      items: [
        { ruta: 'cierre', icono: '🔒', nombre: 'Cerrar tienda', modulo: 'cierre' as Modulo },
        { ruta: 'ajustes', icono: '⚙️', nombre: 'Ajustes', modulo: 'ajustes' as Modulo },
      ],
    },
  ];

  // 🔐 Filtrar items según permisos
  puedeVerItem(modulo: Modulo): boolean {
    return this.permisos.puedeVer(modulo);
  }

  // Grupo visible si AL MENOS UN item se puede ver
  grupoVisible(g: typeof this.gruposSidebar[number]): boolean {
    return g.items.some((i) => this.puedeVerItem(i.modulo));
  }

  // Items filtrados del grupo
  itemsVisibles(g: typeof this.gruposSidebar[number]) {
    return g.items.filter((i) => this.puedeVerItem(i.modulo));
  }

  private subRouter: any;

  ngOnInit(): void {
    this.pedidosService.cargarPedidos();
    this.notificaciones.iniciar();
    this.egresosService.cargar(this.hoyLocal());
    this.actualizarTitulo(this.router.url);
    this.subRouter = this.router.events.subscribe((evento) => {
      if (evento instanceof NavigationEnd) {
        this.actualizarTitulo(evento.url);
        this.cerrarMenu();
      }
    });
  }

  ngOnDestroy(): void {
    this.notificaciones.detener();
    if (this.subRouter) this.subRouter.unsubscribe();
  }

  private actualizarTitulo(url: string): void {
    const mapa: { match: string; titulo: string }[] = [
      { match: 'pedidos',           titulo: 'Gestión de Pedidos' },
      { match: 'pos',               titulo: 'Punto de venta' },
      { match: 'clientes',          titulo: 'Clientes' },
      { match: 'estadisticas',      titulo: 'Estadísticas' },
      { match: 'reporte-productos', titulo: 'Productos entregados' },
      { match: 'productos',         titulo: 'Gestión de Productos' },
      { match: 'egresos',           titulo: 'Egresos' },
      { match: 'promociones',       titulo: 'Promociones' },
      { match: 'marketing',         titulo: 'Marketing' },
      { match: 'referidos',         titulo: 'Referidos y Canjes' },
      { match: 'inversor',          titulo: 'Panel del Inversor' },
      { match: 'empleados',         titulo: 'Empleados' },
      { match: 'usuarios',          titulo: 'Usuarios' },
      { match: 'cierre',            titulo: 'Control de tienda' },
      { match: 'ajustes',           titulo: 'Ajustes' },
    ];
    const match = mapa.find((m) => url.includes(m.match));
    this.tituloRuta.set(match ? match.titulo : 'Panel de Control');
  }

  grupoActivo(g: typeof this.gruposSidebar[number]): boolean {
    const ruta = this.router.url.split('/').pop() ?? '';
    return g.items.some((i) => i.ruta === ruta);
  }

  toggleGrupo(id: string): void {
    this.gruposAbiertos.update((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(id)) nuevo.delete(id); else nuevo.add(id);
      return nuevo;
    });
  }

  estaAbierto(id: string): boolean {
    const grupo = this.gruposSidebar.find((g) => g.id === id);
    return this.gruposAbiertos().has(id) || (grupo ? this.grupoActivo(grupo) : false);
  }

  alternarMenu(): void { this.menuAbierto.update((v) => !v); }
  cerrarMenu(): void { this.menuAbierto.set(false); }
  alternarTema(): void { this.tema.alternar(); }
  cerrarSesion(): void { this.auth.cerrarSesion(); }

  private hoyLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
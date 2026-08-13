import { Routes } from '@angular/router';
import { GuestGuard, roleGuard } from './guards/auth.guard';

export const routes: Routes = [
  // 🌐 Tienda pública
  {
    path: '',
    loadComponent: () => import('./pages/tienda/tienda').then((m) => m.Tienda),
  },
  {
    path: 'domicilios',
    loadComponent: () =>
      import('./pages/programa-domicilios/programa-domicilios').then((m) => m.ProgramaDomicilios),
  },
  {
    path: 'referidos',
    loadComponent: () =>
      import('./pages/programa-referidos/programa-referidos').then((m) => m.ProgramaReferidos),
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/registro/registro').then((m) => m.Registro),
  },
  {
    path: 'confirmado',
    loadComponent: () => import('./pages/confirmado/confirmado').then((m) => m.Confirmado),
  },

  // 🔐 Logins por rol (misma página, distinto título)
  {
    path: 'admin',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [GuestGuard],
    data: { rolPagina: 'admin' },
  },
  {
    path: 'domiciliario',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [GuestGuard],
    data: { rolPagina: 'domiciliario' },
  },
  {
    path: 'cliente',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [GuestGuard],
    data: { rolPagina: 'cliente' },
  },

  // 🛡️ Panel ADMIN
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [roleGuard('admin')],
    children: [
      { path: '', redirectTo: 'pedidos', pathMatch: 'full' },
      { path: 'pedidos', loadComponent: () => import('./pages/pedidos/pedidos').then((m) => m.Pedidos) },
      { path: 'clientes', loadComponent: () => import('./pages/clientes/clientes').then((m) => m.Clientes) },
      { path: 'estadisticas', loadComponent: () => import('./pages/estadisticas/estadisticas').then((m) => m.Estadisticas) },
      { path: 'productos', loadComponent: () => import('./pages/productos/productos').then((m) => m.Productos) },
      { path: 'referidos', loadComponent: () => import('./pages/referidos/referidos').then((m) => m.ReferidosAdmin) },
      { path: 'usuarios', loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.UsuariosAdmin) },
      { path: 'ajustes', loadComponent: () => import('./pages/ajustes/ajustes').then((m) => m.Ajustes) },
    ],
  },

  // 🛵 Panel DOMICILIARIO
  {
    path: 'panel-domiciliario',
    loadComponent: () => import('./pages/panel-domiciliario/panel-domiciliario').then((m) => m.PanelDomiciliario),
    canActivate: [roleGuard('domiciliario')],
  },

  // 🎁 Panel CLIENTE
  {
    path: 'panel-cliente',
    loadComponent: () => import('./pages/panel-cliente/panel-cliente').then((m) => m.PanelCliente),
    canActivate: [roleGuard('cliente')],
  },

  // ❓ 404
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
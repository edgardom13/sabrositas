import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { GuestGuard } from './guards/guest.guard';

export const routes: Routes = [
  // 🌐 Tienda pública
  {
    path: '',
    loadComponent: () => import('./pages/tienda/tienda').then((m) => m.Tienda),
  },

  // 🔐 Login — protegido contra usuarios ya autenticados
  {
    path: 'admin',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    canActivate: [GuestGuard],
  },

  // 🛡️ Dashboard — protegido contra usuarios sin sesión
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'pedidos', pathMatch: 'full' },
      {
        path: 'pedidos',
        loadComponent: () =>
          import('./pages/pedidos/pedidos').then((m) => m.Pedidos),
      },
       {
          path: 'clientes',
          loadComponent: () => import('./pages/clientes/clientes').then((m) => m.Clientes),
        },
        {
        path: 'estadisticas',
        loadComponent: () =>
          import('./pages/estadisticas/estadisticas').then((m) => m.Estadisticas),
      },
      {
        path: 'ajustes',
        loadComponent: () => import('./pages/ajustes/ajustes').then((m) => m.Ajustes),
      },
      {
        path: 'productos',
        loadComponent: () =>
          import('./pages/productos/productos').then((m) => m.Productos),
      },
    ],
  },

  // ❓ Página 404 para cualquier ruta inexistente
  {
    path: '**',
    loadComponent: () =>
      import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
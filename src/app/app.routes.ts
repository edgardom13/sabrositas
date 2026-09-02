import { Routes } from '@angular/router';
import { GuestGuard, roleGuard } from './guards/auth.guard';
import { permisoGuard } from './guards/permiso.guard';

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

  // 🛡️ Panel ADMIN / INVERSOR (ambos pueden entrar al dashboard)
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
    canActivate: [roleGuard('admin', 'inversor')],  // ← permite ambos roles
    children: [
      { path: '', redirectTo: 'pedidos', pathMatch: 'full' },

      // 📦 Pedidos
      {
        path: 'pedidos',
        loadComponent: () => import('./pages/pedidos/pedidos').then((m) => m.Pedidos),
        canActivate: [permisoGuard('pedidos')],
      },

      // 🏪 POS
      {
        path: 'pos',
        loadComponent: () => import('./pages/admin-pos/admin-pos').then((m) => m.AdminPos),
        canActivate: [permisoGuard('pos')],
      },

      // 👥 Clientes
      {
        path: 'clientes',
        loadComponent: () => import('./pages/clientes/clientes').then((m) => m.Clientes),
        canActivate: [permisoGuard('clientes')],
      },

      // 🍽️ Productos (catálogo)
      {
        path: 'productos',
        loadComponent: () => import('./pages/productos/productos').then((m) => m.Productos),
        canActivate: [permisoGuard('catalogo')],
      },

      // 🏷️ Promociones
      {
        path: 'promociones',
        loadComponent: () => import('./pages/admin-promociones/admin-promociones').then((m) => m.AdminPromociones),
        canActivate: [permisoGuard('promociones')],
      },

      // 📣 Marketing
      {
        path: 'marketing',
        loadComponent: () => import('./pages/admin-marketing/admin-marketing').then((m) => m.AdminMarketing),
        canActivate: [permisoGuard('marketing')],
      },

      // 🎁 Referidos
      {
        path: 'referidos',
        loadComponent: () => import('./pages/referidos/referidos').then((m) => m.ReferidosAdmin),
        canActivate: [permisoGuard('referidos')],
      },

      // 📊 Estadísticas
      {
        path: 'estadisticas',
        loadComponent: () => import('./pages/estadisticas/estadisticas').then((m) => m.Estadisticas),
        canActivate: [permisoGuard('reportes')],
      },

      // 📦 Productos entregados
      {
        path: 'reporte-productos',
        loadComponent: () => import('./pages/reporte-productos/reporte-productos').then((m) => m.ReporteProductos),
        canActivate: [permisoGuard('reportes')],
      },

      // 💸 Egresos
      {
        path: 'egresos',
        loadComponent: () => import('./pages/admin-egresos/admin-egresos').then((m) => m.AdminEgresos),
        canActivate: [permisoGuard('egresos')],
      },

      // 💼 Inversor
      {
        path: 'inversor',
        loadComponent: () => import('./pages/admin-inversor/admin-inversor').then((m) => m.AdminInversor),
        canActivate: [permisoGuard('inversor')],
      },

      // 👥 Empleados
      {
        path: 'empleados',
        loadComponent: () => import('./pages/admin-empleados/admin-empleados').then((m) => m.AdminEmpleados),
        canActivate: [permisoGuard('empleados')],
      },

      // 👥 Usuarios
      {
        path: 'usuarios',
        loadComponent: () => import('./pages/usuarios/usuarios').then((m) => m.UsuariosAdmin),
        canActivate: [permisoGuard('usuarios')],
      },

      // 🔒 Cerrar tienda
      {
        path: 'cierre',
        loadComponent: () => import('./pages/admin-cierre/admin-cierre').then((m) => m.AdminCierre),
        canActivate: [permisoGuard('cierre')],
      },

      // ⚙️ Ajustes
      {
        path: 'ajustes',
        loadComponent: () => import('./pages/ajustes/ajustes').then((m) => m.Ajustes),
        canActivate: [permisoGuard('ajustes')],
      },
      { path: 'predictivo', loadComponent: () => import('./pages/admin-predictivo/admin-predictivo').then(m => m.AdminPredictivo), 
        canActivate: [permisoGuard('reportes')] },
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
    // 👩‍🍳 Panel EMPLEADO (solo POS)
  {
    path: 'empleado',
    loadComponent: () =>
      import('./pages/empleado-dashboard/empleado-dashboard').then((m) => m.EmpleadoDashboard),
    canActivate: [roleGuard('empleado')],
  },

  // ❓ 404
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
import { Injectable, inject, signal, computed } from '@angular/core';
import { AuthService } from './auth.service';

export type Modulo =
  | 'pedidos' | 'pos' | 'clientes' | 'catalogo' | 'promociones'
  | 'marketing' | 'referidos' | 'reportes' | 'egresos' | 'inversor'
  | 'empleados' | 'usuarios' | 'cierre' | 'ajustes';

export interface PermisoModulo { ver: boolean; editar: boolean; }

const PERMISOS_ADMIN: Record<Modulo, PermisoModulo> = {
  pedidos:     { ver: true, editar: true },
  pos:         { ver: true, editar: true },
  clientes:    { ver: true, editar: true },
  catalogo:    { ver: true, editar: true },
  promociones: { ver: true, editar: true },
  marketing:   { ver: true, editar: true },
  referidos:   { ver: true, editar: true },
  reportes:    { ver: true, editar: true },
  egresos:     { ver: true, editar: true },
  inversor:    { ver: true, editar: true },
  empleados:   { ver: true, editar: true },
  usuarios:    { ver: true, editar: true },
  cierre:      { ver: true, editar: true },
  ajustes:     { ver: true, editar: true },
};

@Injectable({ providedIn: 'root' })
export class PermisosService {
  private auth = inject(AuthService);

  // Permisos crudos del perfil (JSONB de Supabase)
  permisosRaw = computed<Record<string, PermisoModulo> | null>(() => {
    const p = this.auth.perfil();
    return (p as any)?.permisos ?? null;
  });

  esAdmin = computed(() => this.auth.rol() === 'admin');

  // Resolver permiso de un módulo (admin = todo permitido)
  permiso(modulo: Modulo): PermisoModulo {
    if (this.esAdmin()) return PERMISOS_ADMIN[modulo];
    const raw = this.permisosRaw();
    if (!raw || !raw[modulo]) return { ver: false, editar: false };
    return {
      ver: !!raw[modulo].ver,
      editar: !!raw[modulo].editar,
    };
  }

  puedeVer(modulo: Modulo): boolean {
    return this.permiso(modulo).ver;
  }

  puedeEditar(modulo: Modulo): boolean {
    return this.permiso(modulo).editar;
  }
}
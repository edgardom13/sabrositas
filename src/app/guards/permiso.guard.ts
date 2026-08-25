import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PermisosService, Modulo } from '../services/permisos.service';

// 🔐 Protección por permiso de módulo
export const permisoGuard = (modulo: Modulo): CanActivateFn => {
  return () => {
    const permisos = inject(PermisosService);
    const router = inject(Router);

    if (permisos.puedeVer(modulo)) return true;

    // Sin permiso → al primer módulo permitido (pedidos suele ser seguro)
    router.navigate(['/dashboard/pedidos']);
    return false;
  };
};
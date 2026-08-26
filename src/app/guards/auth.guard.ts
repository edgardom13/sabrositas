import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// 🔓 Usuario invitado (no logueado)
export const GuestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.sesionLista; // ⏳ espera a que la sesión esté lista

  if (!auth.estaAutenticado()) return true;
  router.navigate([auth.rutaPorRol()]);
  return false;
};

// 🛡️ Protección por rol (acepta varios roles)
export const roleGuard = (...rolesPermitidos: string[]): CanActivateFn => {
  const roles = rolesPermitidos.flat();

  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await auth.sesionLista; // ⏳ clave: evita el rebote en blanco al recargar

    if (!auth.estaAutenticado()) {
      router.navigate(['/admin']);
      return false;
    }

    const rol = auth.rol();
    if (rol && roles.includes(rol)) return true;

    router.navigate(['/admin']);
    return false;
  };
};
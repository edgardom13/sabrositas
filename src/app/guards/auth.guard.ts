import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// 🔓 Usuario invitado (no logueado)
export const GuestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) return true;
  router.navigate([auth.rutaPorRol()]);
  return false;
};

// 🛡️ Protección por rol — acepta un string o un array
export const roleGuard = (...rolesPermitidos: string[]): CanActivateFn => {
  // Si el primer argumento es un array, lo aplana
  const roles = rolesPermitidos.flat();

  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.estaAutenticado()) {
      router.navigate(['/admin']);
      return false;
    }

    const rol = auth.rol();
    if (rol && roles.includes(rol)) return true;

    // Rol no permitido → al login de admin
    router.navigate(['/admin']);
    return false;
  };
};
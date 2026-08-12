import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, Rol } from '../services/auth.service';

// Si ya hay sesión → manda a SU panel (no deja ver el login)
export const GuestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const autenticado = await auth.verificarSesion();
  if (!autenticado) return true;

  return router.createUrlTree([auth.rutaPorRol()]);
};

// Fábrica de guards: protege un panel y verifica el ROL correcto
export const roleGuard = (rolEsperado: Rol): CanActivateFn => {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    let autenticado = auth.estaAutenticado();
    if (!autenticado) autenticado = await auth.verificarSesion();

    if (!autenticado) {
      // Sin sesión → al login de ese rol
      const loginPorRol: Record<Rol, string> = {
        admin: '/admin',
        domiciliario: '/domiciliario',
        cliente: '/cliente',
      };
      return router.createUrlTree([loginPorRol[rolEsperado]]);
    }

    if (auth.rol() === rolEsperado) return true;

    // Autenticado pero con otro rol → a SU panel
    return router.createUrlTree([auth.rutaPorRol()]);
  };
};
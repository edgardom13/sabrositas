import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Solo permite entrar al login si NO hay sesión activa
export const GuestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const autenticado = await auth.verificarSesion();

  if (!autenticado) {
    return true; // Puede ver el login
  }

  // Ya hay sesión → lo mandamos directo al dashboard
  return router.createUrlTree(['/dashboard/pedidos']);
};
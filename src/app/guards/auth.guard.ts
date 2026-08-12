import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Solo permite entrar al dashboard si hay sesión válida
export const AuthGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Verifica la sesión REAL contra Supabase (no solo el signal)
  const autenticado = await auth.verificarSesion();

  if (autenticado) {
    return true;
  }

  return router.createUrlTree(['/admin']);
};
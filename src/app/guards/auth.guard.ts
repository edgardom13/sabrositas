import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

// ⏱️ Si la sesión tarda más de 3s en resolver, continúa igual (evita pantalla negra)
function conTimeout<T>(promesa: Promise<T>, ms = 3000): Promise<T | void> {
  return Promise.race([
    promesa,
    new Promise<void>((resolver) => setTimeout(resolver, ms)),
  ]);
}

export const GuestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await conTimeout(auth.sesionLista);

  if (!auth.estaAutenticado()) return true;
  router.navigate([auth.rutaPorRol()]);
  return false;
};

export const roleGuard = (...rolesPermitidos: string[]): CanActivateFn => {
  const roles = rolesPermitidos.flat();

  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    await conTimeout(auth.sesionLista);

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
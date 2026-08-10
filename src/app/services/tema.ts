import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Tema {
  oscuro = signal(true);

  constructor() {
    const guardado = localStorage.getItem('tema-sabrositas');
    if (guardado) this.oscuro.set(guardado === 'oscuro');
    this.aplicar();
  }

  alternar(): void {
    this.oscuro.update((v) => !v);
    localStorage.setItem('tema-sabrositas', this.oscuro() ? 'oscuro' : 'claro');
    this.aplicar();
  }

  private aplicar(): void {
    document.body.classList.toggle('claro', !this.oscuro());
  }
}
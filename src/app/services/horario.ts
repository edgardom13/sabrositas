import { computed, Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Horario {
  readonly HORA_APERTURA = 1; // 4:00 p. m.
  readonly HORA_CIERRE = 22;   // 10:00 p. m.

  private ahora = signal(new Date());

  constructor() {
    // Revisa el reloj cada 30 segundos
    setInterval(() => this.ahora.set(new Date()), 30_000);
  }

  horaEnColombia = computed(() => {
    const partes = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(this.ahora());
    const valor = partes.find((p) => p.type === 'hour')?.value ?? '0';
    return parseInt(valor, 10) % 24;
  });

  abierto = computed(() => {
    const h = this.horaEnColombia();
    return h >= this.HORA_APERTURA && h < this.HORA_CIERRE;
  });
}
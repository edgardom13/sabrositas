import { computed, Injectable, inject, signal } from '@angular/core';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class Horario {
  private configService = inject(ConfigService);

  readonly HORA_APERTURA = 16;  // 4:00 p. m.
  readonly HORA_CIERRE = 22;   // 10:00 p. m.

  private ahora = signal(new Date());

  constructor() {
    setInterval(() => this.ahora.set(new Date()), 30_000);
    this.configService.cargar(); // asegura que la config esté disponible
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

  // 🕓 ¿Está dentro del horario automático?
  abiertoPorHora = computed(() => {
    const h = this.horaEnColombia();
    return h >= this.HORA_APERTURA && h < this.HORA_CIERRE;
  });

  // 🔒 ¿El admin lo cerró manualmente?
  cerradoManual = computed(() => !!this.configService.config().tienda_cerrada);

  // ✅ Estado FINAL: abierto solo si el horario lo permite Y el admin no lo cerró
  abierto = computed(() => this.abiertoPorHora() && !this.cerradoManual());

  // ===== Acciones del admin =====
  async cerrarAhora(): Promise<boolean> {
    return this.configService.guardar({ tienda_cerrada: true });
  }

  async abrirAhora(): Promise<boolean> {
    return this.configService.guardar({ tienda_cerrada: false });
  }
}
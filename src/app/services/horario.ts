import { computed, Injectable, inject, signal } from '@angular/core';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class Horario {
  private configService = inject(ConfigService);

  readonly HORA_APERTURA = 16;  // 4:00 p.m.
  readonly HORA_CIERRE = 22;    // 10:00 p.m.

  private ahora = signal(new Date());

  constructor() {
    setInterval(() => this.ahora.set(new Date()), 30_000);
    this.configService.cargar();
  }

  horaEnColombia = computed(() => {
    const partes = new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota',
      hour: 'numeric', hour12: false,
    }).formatToParts(this.ahora());
    const valor = partes.find((p) => p.type === 'hour')?.value ?? '0';
    return parseInt(valor, 10) % 24;
  });

  abiertoPorHora = computed(() => {
    const h = this.horaEnColombia();
    return h >= this.HORA_APERTURA && h < this.HORA_CIERRE;
  });

  cerradoManual = computed(() => !!this.configService.config().tienda_cerrada);

  // ✅ Abierto = dentro de horario Y no cerrado manualmente
  abierto = computed(() => this.abiertoPorHora() && !this.cerradoManual());

  // 🕓 ¿A qué hora se enviará el pedido si es programado?
  proximaApertura = computed(() => {
    const ahora = this.ahora();
    const h = this.horaEnColombia();
    const apertura = new Date(ahora);
    apertura.setHours(this.HORA_APERTURA, 0, 0, 0);

    // Si es antes de las 4pm del mismo día → hoy a las 4pm
    if (h < this.HORA_APERTURA) return apertura;

    // Si es después de las 10pm → mañana a las 4pm
    const manana = new Date(ahora);
    manana.setDate(manana.getDate() + 1);
    manana.setHours(this.HORA_APERTURA, 0, 0, 0);
    return manana;
  });

  proximaAperturaTexto = computed(() => {
    const f = this.proximaApertura();
    const ahora = this.ahora();
    const mismoDia = f.toDateString() === ahora.toDateString();
    const manana = new Date(ahora); manana.setDate(ahora.getDate() + 1);
    const esManana = f.toDateString() === manana.toDateString();

    const hora = f.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (mismoDia) return `hoy a las ${hora}`;
    if (esManana) return `mañana a las ${hora}`;
    return f.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }) + ` a las ${hora}`;
  });

  async cerrarAhora(): Promise<boolean> {
    return this.configService.guardar({ tienda_cerrada: true });
  }

  async abrirAhora(): Promise<boolean> {
    return this.configService.guardar({ tienda_cerrada: false });
  }
}
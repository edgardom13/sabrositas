import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { SupabaseService, Pedido } from './supabase';
import { PedidosService } from './pedidos.service';

@Injectable({ providedIn: 'root' })
export class NotificacionesService implements OnDestroy {
  private supabase = inject(SupabaseService);
  private pedidosService = inject(PedidosService);

  // 🔔 Preferencia guardada en localStorage
  sonidoActivado = signal<boolean>(
    localStorage.getItem('sonido-pedidos') !== 'off',
  );

  // Toast visible en el dashboard
  toast = signal<Pedido | null>(null);

  private channel?: RealtimeChannel;
  private timeoutToast?: ReturnType<typeof setTimeout>;

  // ===== Iniciar escucha en tiempo real =====
  iniciar(): void {
    if (this.channel) return; // ya iniciado

    this.channel = this.supabase.client.channel('nuevos-pedidos');

    this.channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        (payload) => {
          const pedido = payload.new as Pedido;
          this.recibirPedido(pedido);
        },
      )
      .subscribe();
  }

  detener(): void {
    if (this.channel) {
      this.supabase.client.removeChannel(this.channel);
      this.channel = undefined;
    }
  }

  ngOnDestroy(): void {
    this.detener();
  }

  alternarSonido(): void {
    this.sonidoActivado.update((v) => !v);
    localStorage.setItem('sonido-pedidos', this.sonidoActivado() ? 'on' : 'off');
  }

  // ===== Cuando llega un pedido nuevo =====
  private recibirPedido(pedido: Pedido): void {
    // 1. Lo agrega a la lista al instante (sin recargar)
    this.pedidosService.agregarLocal(pedido);

    // 2. Toast visual por 8 segundos
    this.toast.set(pedido);
    clearTimeout(this.timeoutToast);
    this.timeoutToast = setTimeout(() => this.toast.set(null), 8000);

    // 3. Beep + voz "Nuevo pedido"
    if (this.sonidoActivado()) {
      this.beep();
      this.anunciar(`Nuevo pedido de ${pedido.nombre_cliente}`);
    }
  }

  // 🔊 Voz del sistema en español
  private anunciar(texto: string): void {
    try {
      const voz = new SpeechSynthesisUtterance(texto);
      voz.lang = 'es-ES';
      voz.rate = 1;
      voz.volume = 1;
      window.speechSynthesis.speak(voz);
    } catch {
      // si el navegador no soporta síntesis de voz, solo queda el beep
    }
  }

  // 🔔 Beep generado con WebAudio (sin archivos externos)
  private beep(): void {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = 880;

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);

      osc.start();
      osc.stop(ctx.currentTime + 0.7);
    } catch {
      // silencio si WebAudio no está disponible
    }
  }
}
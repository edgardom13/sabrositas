import { Component, signal, OnInit } from '@angular/core';

@Component({
  selector: 'app-install-pwa',
  standalone: true,
  imports: [],
  templateUrl: './install-pwa.html',
  styleUrl: './install-pwa.css',
})
export class InstallPwa implements OnInit {
  deferredPrompt = signal<any>(null);
  mostrarAyuda = signal<'ios' | 'android' | null>(null);
  puedeInstalar = signal(false); // ← Solo mostrar si REALMENTE se puede
  visitas = signal(0);

  ngOnInit(): void {
    // Contador de visitas (para no molestar de entrada)
    const count = parseInt(localStorage.getItem('pwa-visitas') || '0', 10);
    this.visitas.set(count + 1);
    localStorage.setItem('pwa-visitas', String(this.visitas()));

    // Captura del prompt (múltiples estrategias)
    const previo = (window as any).__deferredInstallPrompt;
    if (previo) {
      this.deferredPrompt.set(previo);
      this.puedeInstalar.set(true);
    }

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
      this.puedeInstalar.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
      this.puedeInstalar.set(false);
      (window as any).__deferredInstallPrompt = null;
    });
  }

  get yaInstalada(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    );
  }

  get esIOS(): boolean {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
  }

  get esAndroid(): boolean {
    return /android/i.test(navigator.userAgent);
  }

  // 🎯 Solo mostrar si: no está instalada + hay prompt + ha visitado al menos 2 veces
  get mostrarBoton(): boolean {
    return !this.yaInstalada && this.puedeInstalar() && this.visitas() >= 2;
  }

  // 💡 Mostrar badge sutil si hay prompt pero no queremos ser invasivos
  get mostrarBadge(): boolean {
    return !this.yaInstalada && this.puedeInstalar() && this.visitas() < 2;
  }

  async instalar(): Promise<void> {
    const prompt = this.deferredPrompt();

    if (prompt) {
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') {
          this.puedeInstalar.set(false);
        }
        this.deferredPrompt.set(null);
        (window as any).__deferredInstallPrompt = null;
      } catch (err) {
        console.error('Error al instalar:', err);
        this.mostrarAyuda.set(this.esIOS ? 'ios' : 'android');
      }
      return;
    }

    // Sin prompt → instrucciones manuales
    this.mostrarAyuda.set(this.esIOS ? 'ios' : 'android');
  }

  cerrarAyuda(): void {
    this.mostrarAyuda.set(null);
    // Guardar que ya vio las instrucciones (no molestar por 24h)
    localStorage.setItem('pwa-visto-ayuda', String(Date.now()));
  }

  // Verificar si ya vio las instrucciones recientemente
  get yaVioAyuda(): boolean {
    const visto = parseInt(localStorage.getItem('pwa-visto-ayuda') || '0', 10);
    return Date.now() - visto < 24 * 60 * 60 * 1000; // 24 horas
  }
}
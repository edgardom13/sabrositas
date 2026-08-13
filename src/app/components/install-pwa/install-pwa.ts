import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-install-pwa',
  standalone: true,
  imports: [],
  templateUrl: './install-pwa.html',
  styleUrl: './install-pwa.css',
})
export class InstallPwa {
  deferredPrompt = signal<any>(null);
  mostrarAyuda = signal<'ios' | 'android' | null>(null);

  constructor() {
    // ✅ Si el prompt llegó ANTES de que Angular arrancara (script del index.html)
    const previo = (window as any).__deferredInstallPrompt;
    if (previo) this.deferredPrompt.set(previo);

    window.addEventListener('pwa-prompt-ready', () => {
      this.deferredPrompt.set((window as any).__deferredInstallPrompt);
    });

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt.set(e);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
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

  // 📲 El botón se muestra en CUALQUIER plataforma móvil o con prompt disponible
  get mostrarBoton(): boolean {
    return !this.yaInstalada && (this.deferredPrompt() !== null || this.esAndroid || this.esIOS);
  }

  async instalar(): Promise<void> {
    const prompt = this.deferredPrompt();

    // 🤖 Android / 💻 Escritorio: prompt nativo de Chrome
    if (prompt) {
      prompt.prompt();
      await prompt.userChoice;
      this.deferredPrompt.set(null);
      (window as any).__deferredInstallPrompt = null;
      return;
    }

    // 📱 Sin prompt nativo → instrucciones manuales según plataforma
    this.mostrarAyuda.set(this.esIOS ? 'ios' : 'android');
  }

  cerrarAyuda(): void {
    this.mostrarAyuda.set(null);
  }
}
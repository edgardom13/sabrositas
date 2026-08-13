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
  modalInvasivo = signal(false);

  private yaMostroInvasivo = false;

  ngOnInit(): void {
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
      this.modalInvasivo.set(false);
      (window as any).__deferredInstallPrompt = null;
    });

    // 🔥 INVASIVO: a los 3s en móvil, si no está instalada, muestra el modal
    if (this.esMovil && !this.yaInstalada) {
      const vio = sessionStorage.getItem('pwa-invasivo-visto');
      if (!vio) {
        setTimeout(() => {
          this.modalInvasivo.set(true);
          this.yaMostroInvasivo = true;
          sessionStorage.setItem('pwa-invasivo-visto', '1');
        }, 3000);
      }
    }
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

  get esMovil(): boolean {
    return this.esAndroid || this.esIOS;
  }

  get mostrar(): boolean {
    return !this.yaInstalada && this.esMovil;
  }

  get tienePrompt(): boolean {
    return this.deferredPrompt() !== null;
  }

  // 🚀 Instala con prompt nativo o muestra instrucciones
  async instalar(): Promise<void> {
    const prompt = this.deferredPrompt();

    if (prompt) {
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') {
          this.deferredPrompt.set(null);
          this.modalInvasivo.set(false);
          (window as any).__deferredInstallPrompt = null;
          return;
        }
      } catch (err) {
        console.error('Error al instalar:', err);
      }
    }

    // Sin prompt → instrucciones según plataforma
    this.modalInvasivo.set(false);
    this.mostrarAyuda.set(this.esIOS ? 'ios' : 'android');
  }

  cerrarInvasivo(): void {
    this.modalInvasivo.set(false);
  }

  cerrarAyuda(): void {
    this.mostrarAyuda.set(null);
  }
}
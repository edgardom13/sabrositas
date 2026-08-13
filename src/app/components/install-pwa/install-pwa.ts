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

    // 🎉 Cuando el usuario instala la app, guardamos flag permanente
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt.set(null);
      this.modalInvasivo.set(false);
      (window as any).__deferredInstallPrompt = null;
      localStorage.setItem('pwa-instalada', '1'); // ← para identificar usuarios con app
      localStorage.setItem('pwa-invasivo-visto', '1'); // ya no mostrar modal
    });

    // 🔥 INVASIVO: solo 1 vez en la vida (localStorage), a los 3s en móvil
    if (this.esMovil && !this.yaInstalada) {
      const yaVio = localStorage.getItem('pwa-invasivo-visto');
      if (!yaVio) {
        setTimeout(() => {
          this.modalInvasivo.set(true);
          // Marcamos como visto para que NUNCA vuelva a aparecer
          localStorage.setItem('pwa-invasivo-visto', '1');
        }, 3000);
      }
    }
  }

  get yaInstalada(): boolean {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      localStorage.getItem('pwa-instalada') === '1'
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

  async instalar(): Promise<void> {
    const prompt = this.deferredPrompt();

    if (prompt) {
      try {
        prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') {
          this.deferredPrompt.set(null);
          this.modalInvasivo.set(false);
          localStorage.setItem('pwa-instalada', '1');
          localStorage.setItem('pwa-invasivo-visto', '1');
          (window as any).__deferredInstallPrompt = null;
          return;
        }
      } catch (err) {
        console.error('Error al instalar:', err);
      }
    }

    this.modalInvasivo.set(false);
    this.mostrarAyuda.set(this.esIOS ? 'ios' : 'android');
  }

  cerrarInvasivo(): void {
    this.modalInvasivo.set(false);
    // Ya quedó marcado como visto en ngOnInit, no vuelve a salir
  }

  cerrarAyuda(): void {
    this.mostrarAyuda.set(null);
  }
}
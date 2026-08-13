import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter, interval } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private swUpdate = inject(SwUpdate);
  
  actualizacionDisponible = signal(false);
  actualizando = signal(false);

  constructor() {
    if (!this.swUpdate.isEnabled) return;

    // 🔄 Verificar actualizaciones cada 30 segundos
    interval(30 * 1000).subscribe(() => this.verificarActualizacion());

    // 🎯 Detectar cuando hay una nueva versión lista
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.actualizacionDisponible.set(true);
        this.aplicarActualizacion();
      });

    // 📡 Verificar al iniciar la app
    this.verificarActualizacion();
  }

  async verificarActualizacion(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    try {
      await this.swUpdate.checkForUpdate();
    } catch (err) {
      console.error('Error verificando actualización:', err);
    }
  }

  async aplicarActualizacion(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    
    this.actualizando.set(true);
    
    try {
      // Activar la nueva versión
      await this.swUpdate.activateUpdate();
      
      // Forzar recarga de la página (silenciosa)
      document.location.reload();
    } catch (err) {
      console.error('Error aplicando actualización:', err);
      this.actualizando.set(false);
    }
  }
}
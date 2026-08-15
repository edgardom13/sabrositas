import { Component, inject, OnInit, signal } from '@angular/core';
import { MensajesMarketingService, MensajeMarketing } from '../../services/mensajes-marketing.service';
import { SupabaseService } from '../../services/supabase';
import { AuthService } from '../../services/auth.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'app-mensajes-cliente',
  standalone: true,
  imports: [],
  templateUrl: './mensajes-cliente.html',
  styleUrl: './mensajes-cliente.css',
})
export class MensajesCliente implements OnInit {
  mensajes = inject(MensajesMarketingService);
  private supabase = inject(SupabaseService);
  private auth = inject(AuthService);
  private config = inject(ConfigService);

  codigoReferido = signal('');
  nombreCliente = signal('');
  copiado = signal<number | null>(null);
  toast = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    await this.config.cargar();
    await this.mensajes.cargarActivos();
    await this.cargarPerfil();
  }

  private async cargarPerfil(): Promise<void> {
    const uid = this.auth.usuario()?.id;
    if (!uid) return;
    const { data } = await this.supabase.client
      .from('perfiles').select('codigo_referido, nombre').eq('id', uid).maybeSingle();
    if (data) {
      this.codigoReferido.set((data as any).codigo_referido ?? '');
      this.nombreCliente.set((data as any).nombre ?? '');
    }
  }

  textoDe(m: MensajeMarketing): string {
    const link = `${window.location.origin}/?ref=${this.codigoReferido()}`;
    return m.mensaje
      .split('{codigo_referido}').join(this.codigoReferido())
      .split('{nombre}').join(this.nombreCliente())
      .split('{link_tienda}').join(link)
      .split('{puntos}').join(String(this.config.config().puntos_referido));
  }

  async copiar(m: MensajeMarketing): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.textoDe(m));
      this.copiado.set(m.id);
      setTimeout(() => this.copiado.set(null), 2000);
    } catch {}
  }

  enviarWhatsApp(m: MensajeMarketing): void {
    window.open(`https://wa.me/?text=${encodeURIComponent(this.textoDe(m))}`, '_blank');
  }

  // 🖼️ NUEVO: descarga imagen + copia texto + abre WhatsApp
  async compartirImagen(m: MensajeMarketing): Promise<void> {
    if (!m.imagen) {
      this.enviarWhatsApp(m);
      return;
    }

    try {
      // 1. Copiar texto al portapapeles
      await navigator.clipboard.writeText(this.textoDe(m));

      // 2. Descargar imagen
      const link = document.createElement('a');
      link.href = m.imagen;
      link.download = `sabrositas-${m.titulo.replace(/\s+/g, '-').toLowerCase()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // 3. Mostrar toast con instrucciones
      this.mostrarToast('📋 Texto copiado + imagen descargada. Pégala en WhatsApp.');

      // 4. Abrir WhatsApp con el texto después de un pequeño delay
      setTimeout(() => {
        window.open(`https://wa.me/?text=${encodeURIComponent(this.textoDe(m))}`, '_blank');
      }, 800);
    } catch (err) {
      // Si falla (ej: permisos), fallback al envío normal
      this.enviarWhatsApp(m);
    }
  }

  private mostrarToast(texto: string): void {
    this.toast.set(texto);
    setTimeout(() => this.toast.set(null), 4000);
  }
}
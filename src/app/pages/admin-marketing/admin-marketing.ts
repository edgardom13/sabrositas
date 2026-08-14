import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MarketingService, ClienteWa } from '../../services/marketing.service';
import { PromocionesService } from '../../services/promociones.service';

@Component({
  selector: 'app-admin-marketing',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-marketing.html',
  styleUrl: './admin-marketing.css',
})
export class AdminMarketing implements OnInit {
  marketing = inject(MarketingService);
  promos = inject(PromocionesService);

  tab = signal<'crear' | 'clientes'>('crear');

  mensaje = '';
  imagenUrl = '';
  cola = signal<ClienteWa[]>([]);
  enviados = signal(0);
  subiendo = signal(false);

  ngOnInit(): void {
    this.marketing.cargarClientes();
    this.promos.cargarActiva();
  }

  totalClientes = computed(() => this.marketing.clientes().length);

  vistaPrevia = computed(() => this.mensaje.split('{nombre}').join('María'));

  usarPlantilla(): void {
    const p = this.promos.activa();
    this.mensaje = p
      ? `🔥 ¡{nombre}, mira lo que tenemos HOY en Sabrositas! 🔥\n\n🥟 *${p.nombre}* por solo *$${Number(p.precio).toLocaleString('es-CO')}*\n\n${p.descripcion || '¡No te la pierdas!'}\n\n📲 Pídela aquí: ${window.location.origin}\n\n¡Corre que se agotan! 🏃`
      : `🥟 ¡{nombre}, Sabrositas te extraña! ❤️\n\nHoy es un gran día para unas empanaditas. Pide aquí: ${window.location.origin}`;
  }

  mensajePara(c: ClienteWa): string {
    return this.mensaje.split('{nombre}').join(c.nombre.split(' ')[0]);
  }

  prepararCola(): void {
    this.cola.set([...this.marketing.clientes()]);
    this.enviados.set(0);
  }

  get siguiente(): ClienteWa | null {
    return this.cola()[0] ?? null;
  }

  get progreso(): number {
    const total = this.cola().length + this.enviados();
    return total > 0 ? Math.round((this.enviados() / total) * 100) : 0;
  }

  enviarSiguiente(): void {
    const c = this.siguiente;
    if (!c) return;
    window.open(this.marketing.linkWa(c.telefono, this.mensajePara(c)), '_blank');
    this.cola.update((q) => q.slice(1));
    this.enviados.update((n) => n + 1);
  }

  enviarIndividual(c: ClienteWa): void {
    window.open(this.marketing.linkWa(c.telefono, this.mensajePara(c)), '_blank');
  }

  async subirImagen(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.subiendo.set(true);
    const url = await this.promos.subirImagen(file);
    if (url) this.imagenUrl = url;
    this.subiendo.set(false);
  }

  cancelarCola(): void {
    this.cola.set([]);
    this.enviados.set(0);
  }

  formatearFecha(iso: string): string {
    const f = new Date(iso);
    return `${String(f.getDate()).padStart(2, '0')}/${String(f.getMonth() + 1).padStart(2, '0')}/${String(f.getFullYear()).slice(-2)}`;
  }
}
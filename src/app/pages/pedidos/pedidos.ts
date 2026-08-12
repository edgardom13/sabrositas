import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { PedidosService, EstadoPedido } from '../../services/pedidos.service';
import { Pedido } from '../../services/supabase';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [],
  templateUrl: './pedidos.html',
  styleUrl: './pedidos.css',
})
export class Pedidos implements OnInit, OnDestroy {
  pedidosService = inject(PedidosService);
  private auth = inject(AuthService);

  filtroEstado = signal<'todos' | EstadoPedido>('todos');
  busqueda = signal('');
  pedidoExpandido = signal<number | null>(null);
  procesando = signal<number | null>(null);
  mensajeExito = signal<string | null>(null);
  
domiciliariosDisponibles = signal<any[]>([]);

  // 📅 Por defecto: solo el día de hoy
  fechaSeleccionada = signal<string>(this.hoyLocal());
  verHistorico = signal(false);

  private intervalo?: ReturnType<typeof setInterval>;
  private configService = inject(ConfigService);

  filtros: { valor: 'todos' | EstadoPedido; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: '🌐 Todos' },
    { valor: 'pendiente', etiqueta: '⏳ Pendientes' },
    { valor: 'preparando', etiqueta: '👨‍ Preparando' },
    { valor: 'en_camino', etiqueta: '🛵 En camino' },
    { valor: 'entregado', etiqueta: '✅ Entregados' },
    { valor: 'cancelado', etiqueta: '❌ Cancelados' },
  ];

  estadosPedido: EstadoPedido[] = [
    'pendiente',
    'preparando',
    'en_camino',
    'entregado',
    'cancelado',
  ];

  // ===== 📅 Pedidos del día elegido (o histórico) =====
  pedidosFecha = computed(() => {
    if (this.verHistorico()) return this.pedidosService.pedidos();
    const fecha = this.fechaSeleccionada();
    return this.pedidosService.pedidos().filter((p) => this.esMismoDia(p.creado_en, fecha));
  });

  // ===== Lista final (día + estado + búsqueda) =====
  pedidosFiltrados = computed(() => {
    let lista = this.pedidosFecha();

    const estado = this.filtroEstado();
    if (estado !== 'todos') {
      lista = lista.filter((p) => p.estado === estado);
    }

    const q = this.busqueda().trim().toLowerCase();
    if (q) {
      lista = lista.filter(
        (p) =>
          `${p.nombre_cliente} ${p.apellido_cliente}`.toLowerCase().includes(q) ||
          p.telefono.includes(q) ||
          String(p.id).includes(q),
      );
    }

    return lista;
  });

  // ===== 📊 Estadísticas del día elegido =====
  statsDia = computed(() => {
    const lista = this.pedidosFecha();
    const entregados = lista.filter((p) => p.estado === 'entregado');
    return {
      pendientes: lista.filter((p) => p.estado === 'pendiente').length,
      enCamino: lista.filter((p) => p.estado === 'en_camino').length,
      entregados: entregados.length,
      recogido: entregados.reduce((t, p) => t + Number(p.total), 0),
      productos: entregados.reduce((t, p) => t + (Number(p.subtotal) - Number(p.descuento)), 0),
      domicilios: entregados.reduce((t, p) => t + Number(p.domicilio), 0),
    };
  });

  textoFecha = computed(() => {
    const [y, m, d] = this.fechaSeleccionada().split('-').map((n) => Number(n));
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  });

  ngOnInit(): void {
     this.pedidosService.cargarPedidos();
  this.cargarDomiciliarios(); // ← nuevo
  this.intervalo = setInterval(() => {
    this.pedidosService.cargarPedidos();
  }, 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async cargarDomiciliarios(): Promise<void> {
  const { data } = await this.auth['supabase'].client
    .from('perfiles')
    .select('id, nombre')
    .eq('rol', 'domiciliario');
  this.domiciliariosDisponibles.set(data ?? []);
}

async asignarDomiciliario(pedido: Pedido, evento: Event): Promise<void> {
  const id = (evento.target as HTMLSelectElement).value || null;
  this.procesando.set(pedido.id);
  const { error } = await this.pedidosService['supabase'].client
    .from('pedidos')
    .update({ domiciliario_id: id })
    .eq('id', pedido.id);
  this.procesando.set(null);

  if (!error) {
    this.pedidosService.pedidos.update((lista) =>
      lista.map((p) => (p.id === pedido.id ? { ...p, domiciliario_id: id } : p)),
    );
    this.mostrarMensaje(id ? '🛵 Domiciliario asignado' : 'Sin domiciliario');
  }
}


  // ===== 📅 Manejo de fechas =====
  private hoyLocal(): string {
    const d = new Date();
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const dia = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${dia}`;
  }

  private esMismoDia(iso: string, fecha: string): boolean {
    const f = new Date(iso);
    const [y, m, d] = fecha.split('-').map((n) => Number(n));
    return f.getFullYear() === y && f.getMonth() + 1 === m && f.getDate() === d;
  }

  cambiarFecha(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) {
      this.fechaSeleccionada.set(valor);
      this.verHistorico.set(false);
    }
  }

  irAHoy(): void {
    this.fechaSeleccionada.set(this.hoyLocal());
    this.verHistorico.set(false);
  }

  // ===== Contadores de los chips =====
  conteoDe(valor: 'todos' | EstadoPedido): number {
    if (valor === 'todos') return this.pedidosFecha().length;
    return this.pedidosFecha().filter((p) => p.estado === valor).length;
  }

  // ===== ▶️ Avance rápido de estado =====
  siguienteEstado(estado: EstadoPedido): EstadoPedido | null {
    const flujo: EstadoPedido[] = ['pendiente', 'preparando', 'en_camino', 'entregado'];
    const i = flujo.indexOf(estado);
    if (i === -1 || i === flujo.length - 1) return null;
    return flujo[i + 1];
  }

  async avanzarEstado(pedido: Pedido): Promise<void> {
    const sig = this.siguienteEstado(pedido.estado);
    if (sig) await this.cambiarEstado(pedido, sig);
  }

  alternarDetalle(id: number): void {
    this.pedidoExpandido.update((v) => (v === id ? null : id));
  }

  actualizarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  async cambiarEstado(pedido: Pedido, estado: EstadoPedido): Promise<void> {
    if (pedido.estado === estado) return;

    // 🛡️ Confirmación antes de cancelar
    if (estado === 'cancelado') {
      if (!confirm(`¿Cancelar el pedido #${pedido.id}? Esta acción no se puede deshacer.`)) {
        return;
      }
    }

    this.procesando.set(pedido.id);
    const ok = await this.pedidosService.cambiarEstado(pedido.id, estado);
        if (ok && estado === 'entregado') {
      await this.pedidosService.otorgarPuntosReferido(pedido.id);
    }
    this.procesando.set(null);
    if (ok) {
      this.mostrarMensaje(`Pedido #${pedido.id} → ${this.pedidosService.textoEstado(estado)}`);
    }
  }

  async marcarPagado(pedido: Pedido, metodo: string): Promise<void> {
    this.procesando.set(pedido.id);
    const ok = await this.pedidosService.marcarComoPagado(pedido.id, metodo);
    this.procesando.set(null);
    if (ok) {
      this.mostrarMensaje(`Pedido #${pedido.id} marcado como PAGADO 💰`);
    }
  }

  esNuevo(pedido: Pedido): boolean {
    return Date.now() - new Date(pedido.creado_en).getTime() < 5 * 60 * 1000;
  }

  tiempoRelativo(iso: string): string {
    const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (min < 1) return 'ahora mismo';
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} d`;
  }

  linkWhatsApp(telefono: string): string {
    const limpio = telefono.replace(/\D/g, '');
    return `https://wa.me/57${limpio}`;
  }

  linkMapa(pedido: Pedido): string {
    return `https://www.google.com/maps?q=${pedido.lat},${pedido.lng}`;
  }

  private mostrarMensaje(texto: string): void {
    this.mensajeExito.set(texto);
    setTimeout(() => this.mensajeExito.set(null), 3000);
  }

  // ===== 💬 Plantillas de WhatsApp =====
enviarWhatsapp(pedido: Pedido, tipo: 'recibido' | 'camino' | 'entregado'): void {
  const config = this.configService.config();
  const plantilla =
    tipo === 'recibido' ? config.plantilla_recibido :
    tipo === 'camino' ? config.plantilla_camino :
    config.plantilla_entregado;

  const mensaje = this.aplicarPlantilla(plantilla, pedido);
  const limpio = pedido.telefono.replace(/\D/g, '');
  window.open(`https://wa.me/57${limpio}?text=${encodeURIComponent(mensaje)}`, '_blank');
}

private aplicarPlantilla(plantilla: string, pedido: Pedido): string {
  return plantilla
    .split('{nombre}').join(`${pedido.nombre_cliente} ${pedido.apellido_cliente}`)
    .split('{pedido}').join(`#${pedido.id}`)
    .split('{total}').join(this.pedidosService.formatearPrecio(pedido.total))
    .split('{direccion}').join(pedido.direccion)
    .split('{negocio}').join('Sabrositas');
}
}
import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { PedidosService, EstadoPedido } from '../../services/pedidos.service';
import { Pedido } from '../../services/supabase';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase';
import { EgresosService } from '../../services/egresos.service';

interface Domiciliario { id: string; nombre: string; }
interface InfoCanje { codigo: string; premio: string; tipo: string; valor: number; cantidad: number; }

@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [],
  templateUrl: './pedidos.html',
  styleUrl: './pedidos.css',
})
export class Pedidos implements OnInit, OnDestroy {
  pedidosService = inject(PedidosService);
  egresosService = inject(EgresosService);
  private auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private configService = inject(ConfigService);

  filtroEstado = signal<'todos' | EstadoPedido>('todos');
  busqueda = signal('');
  pedidoExpandido = signal<number | null>(null);
  procesando = signal<number | null>(null);
  mensajeExito = signal<string | null>(null);

  domiciliariosDisponibles = signal<Domiciliario[]>([]);
  canjesInfo = signal<Map<number, InfoCanje>>(new Map());

  fechaSeleccionada = signal<string>(this.hoyLocal());
  verHistorico = signal(false);

  private intervalo?: ReturnType<typeof setInterval>;

  filtros: { valor: 'todos' | EstadoPedido; etiqueta: string }[] = [
    { valor: 'todos', etiqueta: '🌐 Todos' },
    { valor: 'pendiente', etiqueta: '⏳ Pendientes' },
    { valor: 'preparando', etiqueta: '👨‍🍳 Preparando' },
    { valor: 'en_camino', etiqueta: '🛵 En camino' },
    { valor: 'entregado', etiqueta: '✅ Entregados' },
    { valor: 'cancelado', etiqueta: '❌ Cancelados' },
  ];

  estadosPedido: EstadoPedido[] = [
    'pendiente', 'preparando', 'en_camino', 'entregado', 'cancelado',
  ];

  pedidosFecha = computed(() => {
    if (this.verHistorico()) return this.pedidosService.pedidos();
    const fecha = this.fechaSeleccionada();
    return this.pedidosService.pedidos().filter((p) => this.esMismoDia(p.creado_en, fecha));
  });

  pedidosFiltrados = computed(() => {
    let lista = this.pedidosFecha();
    const estado = this.filtroEstado();
    if (estado !== 'todos') lista = lista.filter((p) => p.estado === estado);
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

  statsDia = computed(() => {
    const lista = this.pedidosFecha();
    const entregados = lista.filter((p) => p.estado === 'entregado');
    const conCanje = lista.filter((p) => (p as any).codigo_canje).length;
    return {
      pendientes: lista.filter((p) => p.estado === 'pendiente').length,
      enCamino: lista.filter((p) => p.estado === 'en_camino').length,
      entregados: entregados.length,
      conCanje,
      recogido: entregados.reduce((t, p) => t + Number(p.total), 0),
      productos: entregados.reduce((t, p) => t + (Number(p.subtotal) - Number(p.descuento)), 0),
      domicilios: entregados.reduce((t, p) => t + Number(p.domicilio), 0),
    };
  });

  textoFecha = computed(() => {
    const [y, m, d] = this.fechaSeleccionada().split('-').map((n) => Number(n));
    return new Date(y, m - 1, d).toLocaleDateString('es-CO', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  });

  ngOnInit(): void {
    this.pedidosService.cargarPedidos();
    this.cargarDomiciliarios();
    this.egresosService.cargar(this.hoyLocal());
    this.intervalo = setInterval(() => this.pedidosService.cargarPedidos(), 30000);
  }

  ngOnDestroy(): void {
    if (this.intervalo) clearInterval(this.intervalo);
  }

  async cargarDomiciliarios(): Promise<void> {
    const { data } = await this.supabase.client
      .from('perfiles')
      .select('id, nombre')
      .eq('rol', 'domiciliario');
    this.domiciliariosDisponibles.set((data as Domiciliario[]) ?? []);
  }

  nombreDomiciliario(pedido: Pedido): string {
    if (!pedido.domiciliario_id) return '';
    const dom = this.domiciliariosDisponibles().find((d) => d.id === pedido.domiciliario_id);
    return dom?.nombre ?? 'Desconocido';
  }

  async asignarDomiciliario(pedido: Pedido, evento: Event): Promise<void> {
    const id = (evento.target as HTMLSelectElement).value || null;
    this.procesando.set(pedido.id);
    const { error } = await this.supabase.client
      .from('pedidos')
      .update({ domiciliario_id: id })
      .eq('id', pedido.id);
    this.procesando.set(null);

    if (!error) {
      this.pedidosService.pedidos.update((lista) =>
        lista.map((p) => (p.id === pedido.id ? { ...p, domiciliario_id: id } : p)),
      );
      const dom = id ? this.domiciliariosDisponibles().find((d) => d.id === id)?.nombre : null;
      this.mostrarMensaje(dom ? `🛵 Asignado a ${dom}` : 'Domiciliario removido');
    }
  }

  tieneCanje(pedido: Pedido): boolean {
    return !!(pedido as any).codigo_canje;
  }

  async cargarInfoCanje(pedido: Pedido): Promise<InfoCanje | null> {
    const codigo = (pedido as any).codigo_canje;
    if (!codigo) return null;

    const existente = this.canjesInfo().get(pedido.id);
    if (existente) return existente;

    const { data } = await this.supabase.client
      .from('canjes')
      .select('codigo, premio:premios(nombre, tipo, valor, cantidad)')
      .eq('codigo', codigo)
      .maybeSingle();

    if (!data) return null;

    const premio = (data as any).premio;
    const info: InfoCanje = {
      codigo: (data as any).codigo,
      premio: premio?.nombre ?? 'Premio',
      tipo: premio?.tipo ?? 'otro',
      valor: Number(premio?.valor ?? 0),
      cantidad: Number(premio?.cantidad ?? 1),
    };

    this.canjesInfo.update((map) => {
      const nuevo = new Map(map);
      nuevo.set(pedido.id, info);
      return nuevo;
    });

    return info;
  }

  infoCanje(pedido: Pedido): InfoCanje | null {
    return this.canjesInfo().get(pedido.id) ?? null;
  }

  emojiTipoCanje(tipo: string): string {
    const i: Record<string, string> = {
      empanada: '🥟', jugo: '🍹', domicilio: '🛵', monto: '💰', otro: '🎁',
    };
    return i[tipo ?? 'otro'] ?? '🎁';
  }

  private hoyLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
      this.egresosService.cargar(valor);
    }
  }

  irAHoy(): void {
    const hoy = this.hoyLocal();
    this.fechaSeleccionada.set(hoy);
    this.verHistorico.set(false);
    this.egresosService.cargar(hoy);
  }

  conteoDe(valor: 'todos' | EstadoPedido): number {
    if (valor === 'todos') return this.pedidosFecha().length;
    return this.pedidosFecha().filter((p) => p.estado === valor).length;
  }

  siguienteEstado(estado: EstadoPedido): EstadoPedido | null {
    const flujo: EstadoPedido[] = ['pendiente', 'preparando', 'en_camino', 'entregado'];
    const i = flujo.indexOf(estado);
    return i === -1 || i === flujo.length - 1 ? null : flujo[i + 1];
  }

  async avanzarEstado(pedido: Pedido): Promise<void> {
    const sig = this.siguienteEstado(pedido.estado);
    if (sig) await this.cambiarEstado(pedido, sig);
  }

  alternarDetalle(id: number): void {
    this.pedidoExpandido.update((v) => (v === id ? null : id));
    if (this.pedidoExpandido() === id) {
      const pedido = this.pedidosService.pedidos().find((p) => p.id === id);
      if (pedido && this.tieneCanje(pedido)) this.cargarInfoCanje(pedido);
    }
  }

  actualizarBusqueda(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
  }

  async cambiarEstado(pedido: Pedido, estado: EstadoPedido): Promise<void> {
    if (pedido.estado === estado) return;
    if (estado === 'cancelado') {
      if (!confirm(`¿Cancelar el pedido #${pedido.id}?`)) return;
    }
    this.procesando.set(pedido.id);
    const ok = await this.pedidosService.cambiarEstado(pedido.id, estado);
    this.procesando.set(null);
    if (ok) this.mostrarMensaje(`Pedido #${pedido.id} → ${this.pedidosService.textoEstado(estado)}`);
  }

  async marcarPagado(pedido: Pedido, metodo: string): Promise<void> {
    this.procesando.set(pedido.id);
    const ok = await this.pedidosService.marcarComoPagado(pedido.id, metodo);
    this.procesando.set(null);
    if (ok) this.mostrarMensaje(`Pedido #${pedido.id} marcado como PAGADO 💰`);
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
    return `https://wa.me/57${telefono.replace(/\D/g, '')}`;
  }

  linkMapa(pedido: Pedido): string {
    return `https://www.google.com/maps?q=${pedido.lat},${pedido.lng}`;
  }

  private mostrarMensaje(texto: string): void {
    this.mensajeExito.set(texto);
    setTimeout(() => this.mensajeExito.set(null), 3000);
  }

  enviarWhatsapp(pedido: Pedido, tipo: 'recibido' | 'camino' | 'entregado'): void {
    const config = this.configService.config();
    const plantilla =
      tipo === 'recibido' ? config.plantilla_recibido :
      tipo === 'camino' ? config.plantilla_camino :
      config.plantilla_entregado;
    const mensaje = this.aplicarPlantilla(plantilla, pedido);
    window.open(`https://wa.me/57${pedido.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(mensaje)}`, '_blank');
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
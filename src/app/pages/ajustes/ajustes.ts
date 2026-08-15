import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase';
import { PedidosService } from '../../services/pedidos.service';
import { MensajesMarketingService } from '../../services/mensajes-marketing.service';

type TabId = 'negocio' | 'promos' | 'plantillas' | 'mensajes' | 'seguridad' | 'exportar';

@Component({
  selector: 'app-ajustes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './ajustes.html',
  styleUrl: './ajustes.css',
})
export class Ajustes implements OnInit {
  private configService = inject(ConfigService);
  private auth = inject(AuthService);
  private supabase = inject(SupabaseService);
  private pedidosService = inject(PedidosService);
  mensajesService = inject(MensajesMarketingService); // ← público para usar en template

  tab = signal<TabId>('negocio');

  tabs: { id: TabId; icono: string; nombre: string }[] = [
    { id: 'negocio', icono: '🏪', nombre: 'Negocio' },
    { id: 'promos', icono: '🎁', nombre: 'Promos y salsas' },
    { id: 'plantillas', icono: '💬', nombre: 'Plantillas WhatsApp' },
    { id: 'mensajes', icono: '📣', nombre: 'Mensajes marketing' },
    { id: 'seguridad', icono: '🔐', nombre: 'Seguridad' },
    { id: 'exportar', icono: '📊', nombre: 'Exportar datos' },
  ];

  // 📣 Mensajes marketing
  msgTitulo = signal('');
  msgMensaje = signal('');
  msgEmoji = signal('📣');
  msgImagen = signal<string | null>(null);
  msgSubiendo = signal(false);

  // 🏪 Negocio
  whatsapp = signal('');
  domicilio = signal(0);
  puntosReferido = signal(50);
  puntosCompra = signal(10);

  // 🎁 Promos y salsas
  cuponUmbral = signal(0);
  cuponPorcentaje = signal(0);
  salsasGratis = signal(0);
  salsaPrecio = signal(0);

  // 💬 Plantillas
  plantillaRecibido = signal('');
  plantillaCamino = signal('');
  plantillaEntregado = signal('');

  // 🔐 Seguridad
  passwordNueva = signal('');
  passwordConfirmar = signal('');
  errorPassword = signal<string | null>(null);

  guardando = signal(false);
  mensaje = signal<string | null>(null);

  emailUsuario = computed(() => this.auth.usuario()?.email ?? '');

  async ngOnInit(): Promise<void> {
    await this.configService.cargar();
    this.sincronizar();
    await this.mensajesService.cargarTodos(); // ← CARGAR MENSAJES
  }

  private sincronizar(): void {
    const c = this.configService.config();
    this.whatsapp.set(c.whatsapp);
    this.domicilio.set(c.domicilio);
    this.cuponUmbral.set(c.cupon_umbral);
    this.cuponPorcentaje.set(c.cupon_porcentaje);
    this.salsasGratis.set(c.salsas_gratis);
    this.salsaPrecio.set(c.salsa_precio);
    this.puntosReferido.set(c.puntos_referido);
    this.puntosCompra.set(c.puntos_compra ?? 10);
    this.plantillaRecibido.set(c.plantilla_recibido ?? '');
    this.plantillaCamino.set(c.plantilla_camino ?? '');
    this.plantillaEntregado.set(c.plantilla_entregado ?? '');
  }

  // ===== 🏪 Negocio =====
  async guardarNegocio(): Promise<void> {
    const whatsappLimpio = this.whatsapp().replace(/\D/g, '');
    if (whatsappLimpio.length < 10 || whatsappLimpio.length > 15) {
      this.mostrarMensaje('⚠️ WhatsApp inválido: usa código de país + número');
      return;
    }
    if (this.domicilio() <= 0) {
      this.mostrarMensaje('⚠️ El domicilio debe ser mayor a $0');
      return;
    }

    this.guardando.set(true);
    const ok = await this.configService.guardar({
      whatsapp: whatsappLimpio,
      domicilio: this.domicilio(),
      puntos_referido: this.puntosReferido(),
      puntos_compra: this.puntosCompra(),
    });
    this.guardando.set(false);
    this.mostrarMensaje(ok ? '✅ Datos del negocio actualizados' : '❌ Error al guardar');
  }

  // ===== 🎁 Promociones y salsas =====
  async guardarPromociones(): Promise<void> {
    if (this.cuponPorcentaje() < 0 || this.cuponPorcentaje() > 100) {
      this.mostrarMensaje('⚠️ El porcentaje debe estar entre 0 y 100');
      return;
    }
    if (this.salsasGratis() < 0) {
      this.mostrarMensaje('⚠️ Las salsas gratis no pueden ser negativas');
      return;
    }

    this.guardando.set(true);
    const ok = await this.configService.guardar({
      cupon_umbral: this.cuponUmbral(),
      cupon_porcentaje: this.cuponPorcentaje(),
      salsas_gratis: this.salsasGratis(),
      salsa_precio: this.salsaPrecio(),
    });
    this.guardando.set(false);
    this.mostrarMensaje(ok ? '✅ Promociones y salsas actualizadas' : '❌ Error al guardar');
  }

  // ===== 💬 Plantillas =====
  async guardarPlantillas(): Promise<void> {
    this.guardando.set(true);
    const ok = await this.configService.guardar({
      plantilla_recibido: this.plantillaRecibido(),
      plantilla_camino: this.plantillaCamino(),
      plantilla_entregado: this.plantillaEntregado(),
    });
    this.guardando.set(false);
    this.mostrarMensaje(ok ? '✅ Plantillas actualizadas' : '❌ Error al guardar');
  }

  // ===== 🔐 Seguridad =====
  async cambiarPassword(): Promise<void> {
    this.errorPassword.set(null);
    if (this.passwordNueva().length < 6) {
      this.errorPassword.set('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (this.passwordNueva() !== this.passwordConfirmar()) {
      this.errorPassword.set('Las contraseñas no coinciden');
      return;
    }

    this.guardando.set(true);
    const { error } = await this.supabase.client.auth.updateUser({
      password: this.passwordNueva(),
    });
    this.guardando.set(false);

    if (error) {
      this.errorPassword.set('No se pudo cambiar la contraseña');
      return;
    }

    this.passwordNueva.set('');
    this.passwordConfirmar.set('');
    this.mostrarMensaje('✅ Contraseña actualizada correctamente');
  }

  // ===== 📊 Exportar CSV DETALLADO =====
  async exportarCSV(tipo: 'pedidos' | 'egresos' | 'clientes' | 'productos'): Promise<void> {
    let filas: string[][] = [];
    let nombre = '';

    if (tipo === 'pedidos') {
      await this.pedidosService.cargarPedidos();
      const pedidos = this.pedidosService.pedidos();
      if (pedidos.length === 0) { this.mostrarMensaje('⚠️ No hay pedidos'); return; }

      filas = [
        [
          'ID', 'Fecha', 'Hora', 'Cliente', 'Apellido', 'Teléfono', 'Dirección',
          'Latitud', 'Longitud', 'Estado', 'Pagado', 'Método de pago',
          'Subtotal', 'Descuento cupón', 'Domicilio', 'Total',
          'Código canje', 'Promoción aplicada', 'Referido por',
          'Domiciliario ID', 'Puntos otorgados',
          'Productos (JSON)'
        ],
        ...pedidos.map((p) => {
          const f = new Date(p.creado_en);
          return [
            String(p.id),
            f.toLocaleDateString('es-CO'),
            f.toLocaleTimeString('es-CO'),
            p.nombre_cliente,
            p.apellido_cliente,
            p.telefono,
            p.direccion,
            String(p.lat ?? ''),
            String(p.lng ?? ''),
            p.estado,
            p.pagado ? 'Sí' : 'No',
            p.metodo_pago ?? '',
            String(p.subtotal),
            String(p.descuento),
            String(p.domicilio),
            String(p.total),
            (p as any).codigo_canje ?? '',
            (p as any).promo_nombre ?? '',
            p.referido_por ?? '',
            p.domiciliario_id ?? '',
            p.puntos_otorgado ? 'Sí' : 'No',
            JSON.stringify(p.items),
          ];
        }),
      ];
      nombre = 'pedidos-detallado';
    }

    if (tipo === 'egresos') {
      const { data } = await this.supabase.client.from('egresos').select('*').order('fecha', { ascending: false });
      if (!data || data.length === 0) { this.mostrarMensaje('⚠️ No hay egresos'); return; }
      filas = [
        ['ID', 'Fecha', 'Categoría', 'Descripción', 'Monto', 'Creado en'],
        ...data.map((e: any) => [
          String(e.id), e.fecha, e.categoria, e.descripcion, String(e.monto), e.creado_en
        ]),
      ];
      nombre = 'egresos';
    }

    if (tipo === 'clientes') {
      const { data } = await this.supabase.client.from('perfiles').select('*').eq('rol', 'cliente').order('creado_en', { ascending: false });
      if (!data || data.length === 0) { this.mostrarMensaje('⚠️ No hay clientes'); return; }
      filas = [
        ['ID', 'Nombre', 'Teléfono', 'Código referido', 'Puntos', 'Tiene app', 'Registrado'],
        ...data.map((c: any) => [
          c.id, c.nombre ?? '', c.telefono ?? '', c.codigo_referido ?? '',
          String(c.puntos), c.tiene_app ? 'Sí' : 'No', c.creado_en
        ]),
      ];
      nombre = 'clientes';
    }

    if (tipo === 'productos') {
      const { data } = await this.supabase.client.from('productos').select('*').order('orden');
      if (!data || data.length === 0) { this.mostrarMensaje('⚠️ No hay productos'); return; }
      filas = [
        ['ID', 'Nombre', 'Categoría', 'Precio', 'Activo', 'Orden', 'Imagen', 'Creado en'],
        ...data.map((p: any) => [
          String(p.id), p.nombre, p.categoria, String(p.precio),
          p.activo ? 'Sí' : 'No', String(p.orden), p.imagen, p.creado_en
        ]),
      ];
      nombre = 'productos';
    }

    const csv = filas
      .map((f) => f.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sabrositas-${nombre}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.mostrarMensaje(`✅ ${filas.length - 1} registros exportados a CSV`);
  }

  // ===== 📣 MENSAJES MARKETING =====
  async subirImagenMensaje(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.msgSubiendo.set(true);
    const url = await this.mensajesService.subirImagen(file);
    if (url) this.msgImagen.set(url);
    this.msgSubiendo.set(false);
  }

  async crearMensaje(): Promise<void> {
    if (!this.msgTitulo().trim() || !this.msgMensaje().trim()) {
      this.mostrarMensaje('⚠️ Título y mensaje son obligatorios');
      return;
    }
    const ok = await this.mensajesService.crear({
      titulo: this.msgTitulo().trim(),
      mensaje: this.msgMensaje().trim(),
      emoji: this.msgEmoji() || '📣',
      imagen: this.msgImagen(),
    });
    if (ok) {
      this.msgTitulo.set('');
      this.msgMensaje.set('');
      this.msgEmoji.set('📣');
      this.msgImagen.set(null);
      this.mostrarMensaje('✅ Mensaje creado y activo');
    }
  }

  toggleMensaje(id: number, activa: boolean): void {
    this.mensajesService.toggle(id, activa);
  }

  eliminarMensaje(id: number): void {
    if (confirm('¿Eliminar este mensaje?')) this.mensajesService.eliminar(id);
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
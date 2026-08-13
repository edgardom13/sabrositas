import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfigService } from '../../services/config.service';
import { AuthService } from '../../services/auth.service';
import { SupabaseService } from '../../services/supabase';
import { PedidosService } from '../../services/pedidos.service';

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

  // 🏪 Negocio
  whatsapp = signal('');
  domicilio = signal(0);
  puntosReferido = signal(50);

  // 🎁 Promociones y salsas
  cuponUmbral = signal(0);
  cuponPorcentaje = signal(0);
  salsasGratis = signal(0);
  salsaPrecio = signal(0);

  // 🔐 Seguridad
  passwordNueva = signal('');
  passwordConfirmar = signal('');
  errorPassword = signal<string | null>(null);

  guardando = signal(false);
  mensaje = signal<string | null>(null);

  emailUsuario = computed(() => this.auth.usuario()?.email ?? '');

  ngOnInit(): void {
    this.configService.cargar().then(() => this.sincronizar());
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
    });
    this.guardando.set(false);
    this.mostrarMensaje(ok ? 'Datos del negocio actualizados' : 'Error al guardar');
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
      puntos_referido: this.puntosReferido(),
    });
    this.guardando.set(false);
    this.mostrarMensaje(ok ? 'Promociones y salsas actualizadas' : 'Error al guardar');

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
    this.mostrarMensaje('Contraseña actualizada correctamente');
  }

  // ===== 📦 Exportar CSV =====
  async exportarCSV(): Promise<void> {
    await this.pedidosService.cargarPedidos();
    const pedidos = this.pedidosService.pedidos();

    if (pedidos.length === 0) {
      this.mostrarMensaje('⚠️ No hay pedidos para exportar');
      return;
    }

    const filas = [
      ['ID', 'Fecha', 'Cliente', 'Teléfono', 'Dirección', 'Estado', 'Pagado', 'Método pago', 'Subtotal', 'Descuento', 'Domicilio', 'Total'],
      ...pedidos.map((p) => [
        p.id,
        p.creado_en,
        `${p.nombre_cliente} ${p.apellido_cliente}`,
        p.telefono,
        p.direccion,
        p.estado,
        p.pagado ? 'Sí' : 'No',
        p.metodo_pago ?? '',
        p.subtotal,
        p.descuento,
        p.domicilio,
        p.total,
      ]),
    ];

    const csv = filas
      .map((f) => f.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pedidos-sabrositas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    this.mostrarMensaje(`${pedidos.length} pedidos exportados a CSV`);
  }

  private mostrarMensaje(texto: string): void {
    this.mensaje.set(texto);
    setTimeout(() => this.mensaje.set(null), 3000);
  }
}
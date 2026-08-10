import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-boton-carrito',
  imports: [FormsModule],
  templateUrl: './boton-carrito.html',
  styleUrl: './boton-carrito.css',
})
export class BotonCarrito {
  carrito = inject(Carrito);
  panelAbierto = false;

  // ⚠️ Cambia aquí el número si lo necesitas (código de país 57 + número)
  readonly NUMERO_WHATSAPP = '573016017084';
  readonly DOMICILIO = 3000;

  // Datos de entrega
  nombre = '';
  apellido = '';
  telefono = '';
  direccion = '';
  formularioValido = true;

  formatearPrecio(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }

  alternarPanel(): void {
    this.panelAbierto = !this.panelAbierto;
  }

  enviarPedido(): void {
  this.formularioValido =
    this.nombre.trim() !== '' &&
    this.apellido.trim() !== '' &&
    this.telefono.trim() !== '' &&
    this.direccion.trim() !== '';

  if (!this.formularioValido) return;

  const items = this.carrito.itemsSignal();
  const subtotal = this.carrito.totalPedido();
  const total = subtotal + this.DOMICILIO;

  // Fecha y hora actual
  const ahora = new Date();
  const fecha = ahora.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const hora = ahora.toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Número de pedido simple (basado en hora/minuto)
  const numeroPedido = `${ahora.getHours().toString().padStart(2, '0')}${ahora
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;

  // Lista de productos bonita
  const lineasProductos = items
    .map(
      (i, index) =>
        `   ${index + 1}. *${i.cantidad}* x ${i.producto.nombre} ${this.emojiDe(i.producto.nombre)} — _${this.formatearPrecio(i.cantidad * i.producto.precio)}_`,
    )
    .join('\n');

  const mensaje =
    `┏━━━━━━━━━━━━━━━━━━━━━━┓\n` +
    `   🥟 *SABROSITAS* 🥟\n` +
    `   _Empanadas Fritas_\n` +
    `┗━━━━━━━━━━━━━━━━━━━━━━┛\n\n` +
    `📝 *NUEVO PEDIDO #${numeroPedido}*\n` +
    `📅 ${fecha}\n` +
    `🕒 ${hora}\n\n` +
    `╭─────────────────────╮\n` +
    `│   🛒 *DETALLE DEL PEDIDO*\n` +
    `╰─────────────────────╯\n` +
    `${lineasProductos}\n\n` +
    `╭─────────────────────╮\n` +
    `│   💰 *RESUMEN*\n` +
    `╰─────────────────────╯\n` +
    `   🧾 Subtotal: *${this.formatearPrecio(subtotal)}*\n` +
    `   🛵 Domicilio: *${this.formatearPrecio(this.DOMICILIO)}*\n` +
    `   ━━━━━━━━━━━━━━━━\n` +
    `   💵 *TOTAL A PAGAR: ${this.formatearPrecio(total)}*\n\n` +
    `╭─────────────────────╮\n` +
    `│   📍 *DATOS DE ENTREGA*\n` +
    `╰─────────────────────╯\n` +
    `   👤 *Cliente:* ${this.nombre.trim()} ${this.apellido.trim()}\n` +
    `   📞 *Teléfono:* ${this.telefono.trim()}\n` +
    `   🏠 *Dirección:* ${this.direccion.trim()}\n\n` +
    `✨ _¡Gracias por elegir Sabrositas!_\n` +
    `❤️ _Prepararemos tu pedido con mucho amor._\n` +
    `🥟 _¡Que lo disfrutes!_`;

  window.open(
    `https://wa.me/${this.NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`,
    '_blank',
  );
}

// Pequeño helper para agregar emojis según el producto
private emojiDe(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes('carne')) return '🥩';
  if (n.includes('pollo')) return '🍗';
  if (n.includes('maíz') || n.includes('maiz')) return '🌽';
  if (n.includes('corozo')) return '🍒';
  if (n.includes('queso')) return '🧀';
  return '🥟';
}
}
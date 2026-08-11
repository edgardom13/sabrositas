import { Component, input, inject, signal, computed } from '@angular/core';
import { Producto } from '../../models/producto';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-tarjeta-producto',
  templateUrl: './tarjeta-producto.html',
  styleUrl: './tarjeta-producto.css',
})
export class TarjetaProducto {
  producto = input.required<Producto>();
  carrito = inject(Carrito);
  agregado = signal(false);
  private temporizador?: ReturnType<typeof setTimeout>;

  get cantidad(): number {
    return this.carrito.cantidadDe(this.producto().id);
  }

  // ¿Es un producto de la categoría salsa?
  esSalsa = computed(() => this.producto().categoria === 'salsa');

  // Cuántas salsas gratis le quedan disponibles al cliente
  salsasGratisDisponibles = computed(() => this.carrito.salsasGratisDisponibles());

  // Unidades gratis de ESTA salsa
  salsasGratis = computed(() => this.carrito.salsasGratisDe(this.producto()));

  // Unidades cobradas de ESTA salsa
  salsasCobradas = computed(() => this.carrito.salsasCobradasDe(this.producto()));

  agregar(): void {
    this.carrito.agregar(this.producto());
    this.agregado.set(true);
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.agregado.set(false), 900);
  }

  quitar(): void {
    this.carrito.quitar(this.producto().id);
  }

  formatearPrecio(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }
}
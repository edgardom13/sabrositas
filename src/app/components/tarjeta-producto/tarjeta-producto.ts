import { Component, input, inject, signal } from '@angular/core';import { Producto } from '../../models/producto';
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
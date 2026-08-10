import { Component, input, inject } from '@angular/core';
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

  get cantidad(): number {
    return this.carrito.cantidadDe(this.producto().id);
  }

  agregar(): void {
    this.carrito.agregar(this.producto());
  }

  quitar(): void {
    this.carrito.quitar(this.producto().id);
  }

  formatearPrecio(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }
}
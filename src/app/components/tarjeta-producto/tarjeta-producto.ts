import { Component, input, inject, signal, computed } from '@angular/core';
import { Carrito } from '../../services/carrito';
import { Producto } from '../../services/productos.service';

@Component({
  selector: 'app-tarjeta-producto',
  standalone: true,
  imports: [],
  templateUrl: './tarjeta-producto.html',
  styleUrl: './tarjeta-producto.css',
})
export class TarjetaProducto {
  producto = input.required<Producto>();
  carrito = inject(Carrito);
  agregado = signal(false);
  private temporizador?: ReturnType<typeof setTimeout>;

  // Solo lo imprescindible: cantidad (para stepper) y tipo
  cantidad = computed(() => this.carrito.cantidadDe(this.producto().id));
  esSalsa = computed(() => this.producto().categoria === 'salsa');

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
    return '$' + Number(valor || 0).toLocaleString('es-CO');
  }
}
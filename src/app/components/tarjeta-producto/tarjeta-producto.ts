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

  // ✅ Convertido a computed para reactividad con signals
  cantidad = computed(() => this.carrito.cantidadDe(this.producto().id));

  esSalsa = computed(() => this.producto().categoria === 'salsa');

  salsasGratisDisponibles = computed(() => this.carrito.salsasGratisDisponibles());

  salsasGratis = computed(() => this.carrito.salsasGratisDe(this.producto()));

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
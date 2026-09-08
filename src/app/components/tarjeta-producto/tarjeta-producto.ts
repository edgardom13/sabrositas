import { Component, input, inject, signal, computed } from '@angular/core';
import { Carrito } from '../../services/carrito';
import { Producto, ProductosService } from '../../services/productos.service';
import { ComboTienda } from '../../services/combo-tienda.service';

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
  private productosService = inject(ProductosService);
  private comboTienda = inject(ComboTienda);
  agregado = signal(false);
  private temporizador?: ReturnType<typeof setTimeout>;

  cantidad = computed(() => this.carrito.cantidadDe(this.producto().id));
  esSalsa = computed(() => this.producto().categoria === 'salsa');
  esCombo = computed(() => (this.producto().categoria as string) === 'combo');

  agregar(): void {
    // 🎁 Si es combo, abrir modal de selección en vez de agregar directo
    if (this.esCombo()) {
      const comboId = -10000 - this.producto().id;
      const combo = this.productosService.combos().find((c) => c.id === comboId);
      if (combo) {
        this.comboTienda.abrir(combo);
        return;
      }
    }

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
import { Component, inject } from '@angular/core';
import { Carrito } from '../../services/carrito';
import { Producto } from '../../models/producto';

@Component({
  selector: 'app-combo',
  templateUrl: './combo.html',
  styleUrl: './combo.css',
})
export class Combo {
  private carrito = inject(Carrito);

  combo: Producto = {
    id: 7,
    nombre: 'Combo Sabrositas',
    precio: 12000,
    imagen: '/combo.jpg',
  };

  pedirCombo(): void {
    this.carrito.agregar(this.combo);
  }
}
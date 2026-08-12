import { Component, inject } from '@angular/core';
import { Carrito } from '../../services/carrito';
import { Producto } from '../../services/productos.service';

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
  categoria: 'empanada', // o la que corresponda
  orden: 0,              // ← AGREGA
  activo: true,          // ← AGREGA
};

  pedirCombo(): void {
    this.carrito.agregar(this.combo);
  }
}
import { Component, input } from '@angular/core';
import { TarjetaProducto } from '../tarjeta-producto/tarjeta-producto';
import { Producto } from '../../services/productos.service';

@Component({
  selector: 'app-seccion-menu',
  standalone: true,
  imports: [TarjetaProducto],
  templateUrl: './seccion-menu.html',
  styleUrl: './seccion-menu.css', // ← faltaba el .css
  host: {
    '[class]': "'seccion tema-' + tema()",
    '[id]': 'idSeccion()',
  },
})
export class SeccionMenu {
  idSeccion = input.required<string>();
  titulo = input.required<string>();
  tema = input.required<string>();
  productos = input.required<Producto[]>();
}
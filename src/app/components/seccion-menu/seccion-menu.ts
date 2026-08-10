import { Component, input } from '@angular/core';
import { TarjetaProducto } from '../tarjeta-producto/tarjeta-producto';
import { Producto } from '../../models/producto';

@Component({
  selector: 'app-seccion-menu',
  imports: [TarjetaProducto],
  templateUrl: './seccion-menu.html',
  styleUrl: './seccion-menu.css',
})
export class SeccionMenu {
  idSeccion = input.required<string>();
  titulo = input.required<string>();
  tema = input<'rojo' | 'amarillo' | 'verde'>('rojo');
  productos = input.required<Producto[]>();
}
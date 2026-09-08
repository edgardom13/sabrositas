import { Component, input, signal, effect } from '@angular/core';
import { TarjetaProducto } from '../tarjeta-producto/tarjeta-producto';
import { Producto } from '../../services/productos.service';

@Component({
  selector: 'app-seccion-menu',
  standalone: true,
  imports: [TarjetaProducto],
  templateUrl: './seccion-menu.html',
  styleUrl: './seccion-menu.css',
  host: {
    '[class]': "'seccion seccion-' + tema()",
    '[id]': 'idSeccion()',
  },
})
export class SeccionMenu {
  idSeccion = input.required<string>();
  titulo = input.required<string>();
  tema = input.required<string>();
  productos = input.required<Producto[]>();
  variante = input<'grid' | 'carrusel'>('grid');
  abiertoInicial = input<boolean>(false);

  estaAbierto = signal(false);

  constructor() {
    // 🎯 El effect se ejecuta DESPUÉS de que los inputs están vinculados
    effect(() => {
      this.estaAbierto.set(this.abiertoInicial());
    }, { allowSignalWrites: true });
  }

  toggleAcordeon(): void {
    this.estaAbierto.update((v) => !v);
  }
}
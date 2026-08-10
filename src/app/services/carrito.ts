import { computed, Injectable, signal } from '@angular/core';
import { Producto } from '../models/producto';

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

@Injectable({ providedIn: 'root' })
export class Carrito {
  private items = signal<ItemCarrito[]>([]);

  itemsSignal = this.items.asReadonly();

  totalProductos = computed(() =>
    this.items().reduce((total, i) => total + i.cantidad, 0),
  );

  totalPedido = computed(() =>
    this.items().reduce((total, i) => total + i.cantidad * i.producto.precio, 0),
  );

  agregar(producto: Producto): void {
    this.items.update((items) => {
      const existe = items.find((i) => i.producto.id === producto.id);
      if (existe) {
        return items.map((i) =>
          i.producto.id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i,
        );
      }
      return [...items, { producto, cantidad: 1 }];
    });
  }

  // Resta una unidad; si llega a 0, saca el producto del carrito
  quitar(idProducto: number): void {
    this.items.update((items) =>
      items
        .map((i) => (i.producto.id === idProducto ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter((i) => i.cantidad > 0),
    );
  }

  // Cuántas unidades hay de un producto en el carrito
  cantidadDe(idProducto: number): number {
    const item = this.items().find((i) => i.producto.id === idProducto);
    return item ? item.cantidad : 0;
  }
}
import { computed, Injectable, signal } from '@angular/core';
import { Producto } from '../models/producto';

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

const CLAVE_STORAGE = 'carrito-sabrositas';

@Injectable({ providedIn: 'root' })
export class Carrito {
  // Al iniciar, carga lo que haya quedado guardado
  private items = signal<ItemCarrito[]>(this.cargar());

  itemsSignal = this.items.asReadonly();

  totalProductos = computed(() =>
    this.items().reduce((total, i) => total + i.cantidad, 0),
  );

  totalPedido = computed(() =>
    this.items().reduce((total, i) => total + i.cantidad * i.producto.precio, 0),
  );

  readonly UMBRAL_CUPON = 30000;
  readonly PORCENTAJE_CUPON = 0.06;

  descuento = computed(() => {
    const subtotal = this.totalPedido();
    return subtotal >= this.UMBRAL_CUPON
      ? Math.round(subtotal * this.PORCENTAJE_CUPON)
      : 0;
  });

  faltanteParaCupon = computed(() =>
    Math.max(0, this.UMBRAL_CUPON - this.totalPedido()),
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
    this.guardar();
  }

  quitar(idProducto: number): void {
    this.items.update((items) =>
      items
        .map((i) => (i.producto.id === idProducto ? { ...i, cantidad: i.cantidad - 1 } : i))
        .filter((i) => i.cantidad > 0),
    );
    this.guardar();
  }

  // Limpia el carrito por completo
  vaciar(): void {
    this.items.set([]);
    this.guardar();
  }

  cantidadDe(idProducto: number): number {
    const item = this.items().find((i) => i.producto.id === idProducto);
    return item ? item.cantidad : 0;
  }

  // ===== Guardado en localStorage =====
  private guardar(): void {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(this.items()));
  }

  private cargar(): ItemCarrito[] {
    try {
      const datos = localStorage.getItem(CLAVE_STORAGE);
      return datos ? (JSON.parse(datos) as ItemCarrito[]) : [];
    } catch {
      return [];
    }
  }
}
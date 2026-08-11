import { computed, Injectable, signal } from '@angular/core';
import { Producto } from '../models/producto';

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

const CLAVE_STORAGE = 'carrito-sabrositas';
const MAX_SALSAS_GRATIS = 3;
const PRECIO_SALSA_EXTRA = 500;

@Injectable({ providedIn: 'root' })
export class Carrito {
  private items = signal<ItemCarrito[]>(this.cargar());

  itemsSignal = this.items.asReadonly();

  totalProductos = computed(() =>
    this.items().reduce((total, i) => total + i.cantidad, 0),
  );

  // Total de salsas que hay en el carrito
  totalSalsas = computed(() =>
    this.items()
      .filter((i) => i.producto.categoria === 'salsa')
      .reduce((total, i) => total + i.cantidad, 0),
  );

  // Cuántas salsas gratis tiene el cliente (máx 3)
  salsasGratis = computed(() => Math.min(this.totalSalsas(), MAX_SALSAS_GRATIS));

  // Cuántas salsas son cobradas ($500 c/u)
  salsasCobradas = computed(() => Math.max(0, this.totalSalsas() - MAX_SALSAS_GRATIS));

  // Cuántas salsas gratis le quedan disponibles al cliente
  salsasGratisDisponibles = computed(() =>
    Math.max(0, MAX_SALSAS_GRATIS - this.totalSalsas()),
  );

  // Costo total de las salsas cobradas
  costoSalsasCobradas = computed(() => this.salsasCobradas() * PRECIO_SALSA_EXTRA);

  // Total pedido: productos normales + salsas cobradas
  totalPedido = computed(() => {
    const subtotalProductos = this.items().reduce((total, i) => {
      // Las salsas siempre valen 0 en el producto, solo se cobran las extras
      if (i.producto.categoria === 'salsa') return total;
      return total + i.cantidad * i.producto.precio;
    }, 0);
    return subtotalProductos + this.costoSalsasCobradas();
  });

  readonly UMBRAL_CUPON = 30000;
  readonly PORCENTAJE_CUPON = 0; // 10%

  descuento = computed(() => {
    const subtotal = this.totalPedido();
    return subtotal >= this.UMBRAL_CUPON
      ? Math.round(subtotal * this.PORCENTAJE_CUPON)
      : 0;
  });

  faltanteParaCupon = computed(() =>
    Math.max(0, this.UMBRAL_CUPON - this.totalPedido()),
  );

  // Determina si una salsa específica se cobra o es gratis
  esSalsaCobrada(producto: Producto): boolean {
    if (producto.categoria !== 'salsa') return false;
    // Sumamos las cantidades de las salsas que vienen ANTES (por id)
    const items = this.items();
    let acumulado = 0;
    const idsOrdenados = items
      .filter((i) => i.producto.categoria === 'salsa')
      .sort((a, b) => a.producto.id - b.producto.id);

    for (const item of idsOrdenados) {
      acumulado += item.cantidad;
      if (item.producto.id === producto.id) {
        // Si esta salsa (acumulada) está dentro de las 3 primeras, es gratis
        return acumulado > MAX_SALSAS_GRATIS;
      }
      // Si el acumulado antes de llegar a esta salsa ya es ≥ 3, todas las de esta salsa son cobradas
      if (acumulado >= MAX_SALSAS_GRATIS && item.producto.id === producto.id) {
        return true;
      }
    }
    return false;
  }

  // Cuántas unidades de una salsa específica son cobradas
  salsasCobradasDe(producto: Producto): number {
    if (producto.categoria !== 'salsa') return 0;
    const item = this.items().find((i) => i.producto.id === producto.id);
    if (!item) return 0;

    const idsOrdenados = this.items()
      .filter((i) => i.producto.categoria === 'salsa')
      .sort((a, b) => a.producto.id - b.producto.id);

    let acumulado = 0;
    for (const i of idsOrdenados) {
      if (i.producto.id === producto.id) {
        // De las unidades de esta salsa, las que superen el límite de gratis son cobradas
        const espacioLibre = Math.max(0, MAX_SALSAS_GRATIS - acumulado);
        return Math.max(0, item.cantidad - espacioLibre);
      }
      acumulado += i.cantidad;
    }
    return 0;
  }

  // Cuántas unidades de una salsa específica son gratis
  salsasGratisDe(producto: Producto): number {
    const item = this.items().find((i) => i.producto.id === producto.id);
    if (!item || item.producto.categoria !== 'salsa') return 0;
    return item.cantidad - this.salsasCobradasDe(producto);
  }

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

  vaciar(): void {
    this.items.set([]);
    this.guardar();
  }

  cantidadDe(idProducto: number): number {
    const item = this.items().find((i) => i.producto.id === idProducto);
    return item ? item.cantidad : 0;
  }

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
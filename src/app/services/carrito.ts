import { computed, Injectable, inject, signal } from '@angular/core';
import { Producto } from './productos.service';
import { ConfigService } from './config.service';

export interface ItemCarrito {
  producto: Producto;
  cantidad: number;
}

const CLAVE_STORAGE = 'carrito-sabrositas';

@Injectable({ providedIn: 'root' })
export class Carrito {
  private configService = inject(ConfigService);

  private items = signal<ItemCarrito[]>(this.cargar());

  itemsSignal = this.items.asReadonly();

  // ===== Configuración dinámica (desde Ajustes) =====
  umbralCupon = computed(() => this.configService.config().cupon_umbral);
  porcentajeCupon = computed(() => this.configService.config().cupon_porcentaje / 100);
  porcentajeCuponTexto = computed(() => Math.round(this.porcentajeCupon() * 100));
  maxSalsasGratis = computed(() => this.configService.config().salsas_gratis);
  precioSalsaExtra = computed(() => this.configService.config().salsa_precio);

  totalProductos = computed(() =>
    this.items().reduce((total, i) => total + i.cantidad, 0),
  );

  // ===== Salsas =====
  totalSalsas = computed(() =>
    this.items()
      .filter((i) => i.producto.categoria === 'salsa')
      .reduce((total, i) => total + i.cantidad, 0),
  );

  salsasGratis = computed(() => Math.min(this.totalSalsas(), this.maxSalsasGratis()));

  salsasCobradas = computed(() => Math.max(0, this.totalSalsas() - this.maxSalsasGratis()));

  salsasGratisDisponibles = computed(() =>
    Math.max(0, this.maxSalsasGratis() - this.totalSalsas()),
  );

  costoSalsasCobradas = computed(() => this.salsasCobradas() * this.precioSalsaExtra());

  // ===== Totales =====
  totalPedido = computed(() => {
    const subtotalProductos = this.items().reduce((total, i) => {
      if (i.producto.categoria === 'salsa') return total;
      return total + i.cantidad * i.producto.precio;
    }, 0);
    return subtotalProductos + this.costoSalsasCobradas();
  });

  descuento = computed(() => {
    const subtotal = this.totalPedido();
    return subtotal >= this.umbralCupon()
      ? Math.round(subtotal * this.porcentajeCupon())
      : 0;
  });

  faltanteParaCupon = computed(() =>
    Math.max(0, this.umbralCupon() - this.totalPedido()),
  );

  // ===== Salsas por producto =====
  salsasCobradasDe(producto: Producto): number {
    if (producto.categoria !== 'salsa') return 0;
    const item = this.items().find((i) => i.producto.id === producto.id);
    if (!item) return 0;

    const maxGratis = this.maxSalsasGratis();
    const ordenadas = this.items()
      .filter((i) => i.producto.categoria === 'salsa')
      .sort((a, b) => a.producto.id - b.producto.id);

    let acumulado = 0;
    for (const i of ordenadas) {
      if (i.producto.id === producto.id) {
        const espacioLibre = Math.max(0, maxGratis - acumulado);
        return Math.max(0, item.cantidad - espacioLibre);
      }
      acumulado += i.cantidad;
    }
    return 0;
  }

  salsasGratisDe(producto: Producto): number {
    const item = this.items().find((i) => i.producto.id === producto.id);
    if (!item || item.producto.categoria !== 'salsa') return 0;
    return item.cantidad - this.salsasCobradasDe(producto);
  }

  // ===== Operaciones =====
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

    // ===== 🛡️ Validación: el pedido debe tener al menos 1 producto principal (no salsa) =====
  tieneProductosPrincipales = computed(() =>
    this.items().some((i) => i.producto.categoria !== 'salsa'),
  );

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

    // 🛒 Agregar múltiples productos de una vez (para canjes)
  agregarMultiples(productos: { productoId: number; cantidad: number }[], catalogo: any[]): void {
    this.items.update((items) => {
      const nuevos = [...items];
      for (const p of productos) {
        const producto = catalogo.find((prod) => prod.id === p.productoId);
        if (!producto) continue;

        const existe = nuevos.find((i) => i.producto.id === p.productoId);
        if (existe) {
          nuevos[nuevos.indexOf(existe)] = { ...existe, cantidad: existe.cantidad + p.cantidad };
        } else {
          nuevos.push({ producto, cantidad: p.cantidad });
        }
      }
      return nuevos;
    });
    this.guardar();
  }
}
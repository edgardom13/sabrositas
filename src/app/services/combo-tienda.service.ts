import { Injectable, inject, signal, computed } from '@angular/core';
import { Combo, Producto, ProductosService } from './productos.service';
import { Carrito } from './carrito';

export interface EleccionCombo {
  categoria: string;
  etiqueta: string;
  nombres: string[];
}

@Injectable({ providedIn: 'root' })
export class ComboTienda {
  private productosService = inject(ProductosService);
  private carrito = inject(Carrito);

  comboAbierto = signal<Combo | null>(null);
  // Por cada item del combo: { nombreProducto: cantidad }
  elecciones = signal<Record<string, number>[]>([]);
  toast = signal<string | null>(null);

  abrir(combo: Combo): void {
    this.elecciones.set((combo.items || []).map(() => ({})));
    this.comboAbierto.set(combo);
  }

  cerrar(): void {
    this.comboAbierto.set(null);
    this.elecciones.set([]);
  }

  cantidadElegida(itemIndex: number, nombre: string): number {
    return this.elecciones()[itemIndex]?.[nombre] || 0;
  }

  totalElegido(itemIndex: number): number {
    const obj = this.elecciones()[itemIndex] || {};
    return Object.values(obj).reduce((t, n) => t + (n || 0), 0);
  }

  sumar(itemIndex: number, nombre: string): void {
    const combo = this.comboAbierto();
    if (!combo) return;
    const item = combo.items[itemIndex];
    if (this.totalElegido(itemIndex) >= item.cantidad) return;
    this.elecciones.update((all) => {
      const nuevo = [...all];
      const obj = { ...(nuevo[itemIndex] || {}) };
      obj[nombre] = (obj[nombre] || 0) + 1;
      nuevo[itemIndex] = obj;
      return nuevo;
    });
  }

  restar(itemIndex: number, nombre: string): void {
    this.elecciones.update((all) => {
      const nuevo = [...all];
      const obj = { ...(nuevo[itemIndex] || {}) };
      if ((obj[nombre] || 0) > 0) {
        obj[nombre] -= 1;
        if (obj[nombre] === 0) delete obj[nombre];
      }
      nuevo[itemIndex] = obj;
      return nuevo;
    });
  }

  productosDeItem(item: { categoria: string }): Producto[] {
    return this.productosService.productosPorCategoria(item.categoria as any);
  }

  completo = computed(() => {
    const combo = this.comboAbierto();
    if (!combo) return false;
    return (combo.items || []).every((item, idx) => this.totalElegido(idx) === item.cantidad);
  });

  // 🆕 Construye las elecciones como lista plana
  construirElecciones(): EleccionCombo[] {
    const combo = this.comboAbierto();
    if (!combo) return [];
    return (combo.items || []).map((item, idx) => {
      const obj = this.elecciones()[idx] || {};
      const nombres: string[] = [];
      Object.entries(obj).forEach(([nombre, cant]) => {
        for (let i = 0; i < cant; i++) nombres.push(nombre);
      });
      return { categoria: item.categoria, etiqueta: item.etiqueta, nombres };
    });
  }

  resumenElecciones(): string {
    return this.construirElecciones()
      .map((e) => {
        const cuenta = new Map<string, number>();
        e.nombres.forEach((n) => cuenta.set(n, (cuenta.get(n) || 0) + 1));
        return [...cuenta.entries()].map(([n, c]) => `${c}× ${n}`).join(', ');
      })
      .filter((s) => s.length > 0)
      .join(' + ');
  }

  // 💰 Agrega el combo al carrito con el detalle de lo elegido
  confirmar(): void {
    const combo = this.comboAbierto();
    if (!combo || !this.completo()) return;

    const detalle = this.resumenElecciones();

    // Producto virtual del combo (precio del combo) con el detalle de elecciones
    const virtual = {
      id: -10000 - combo.id,
      nombre: combo.nombre,
      precio: Number(combo.precio),
      imagen: combo.imagen || this.productosService.generarImagenCombo(combo.nombre),
      categoria: 'combo' as any,
      orden: combo.orden,
      activo: true,
      activo_pos: true,
      imagen_pos: null,
      detalle,
    } as Producto;

    this.carrito.agregar(virtual);
    this.mostrarToast(`🎁 ${combo.nombre} agregado al carrito`);
    this.cerrar();
  }

  private mostrarToast(t: string): void {
    this.toast.set(t);
    setTimeout(() => this.toast.set(null), 2500);
  }
}
import { Component, inject, OnInit, signal } from '@angular/core';
import { PromocionesService } from '../../services/promociones.service';
import { ProductosService } from '../../services/productos.service';
import { Carrito } from '../../services/carrito';

@Component({
  selector: 'app-promo-inicio',
  standalone: true,
  imports: [],
  templateUrl: './promo-inicio.html',
  styleUrl: './promo-inicio.css',
})
export class PromoInicio implements OnInit {
  promociones = inject(PromocionesService);
  productos = inject(ProductosService);
  carrito = inject(Carrito);
  visible = signal(false);

  async ngOnInit(): Promise<void> {
    await this.promociones.cargarActiva();
    const p = this.promociones.activa();
    if (!p) return;
    setTimeout(() => this.visible.set(true), 1500);
  }

  querer(): void {
    const p = this.promociones.activa();
    if (!p) return;

    const precioPromo = Number(p.precio) || 0;

    this.carrito.vaciar();
    let suma = 0;
    for (const item of p.productos) {
      const prod = this.productos.catalogo().find((x) => x.id === item.productoId);
      if (prod) {
        const precioProd = Number(prod.precio) || 0;
        const cant = Number(item.cantidad) || 1;
        for (let i = 0; i < cant; i++) this.carrito.agregar(prod);
        suma += precioProd * cant;
      }
    }

    this.carrito.aplicarPromo(p.nombre, Math.max(0, suma - precioPromo));

    this.visible.set(false);
    window.dispatchEvent(new CustomEvent('abrir-carrito'));
  }

  cerrar(): void {
    this.visible.set(false);
  }
}
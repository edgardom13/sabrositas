import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { Hero } from '../../components/hero/hero';
import { SeccionMenu } from '../../components/seccion-menu/seccion-menu';
import { Beneficios } from '../../components/beneficios/beneficios';
import { BotonCarrito } from '../../components/boton-carrito/boton-carrito';
import { Loading } from '../../components/loading/loading';
import { Cerrado } from '../../components/cerrado/cerrado';
import { Aparecer } from '../../directives/aparecer';
import { Horario } from '../../services/horario';
import { ProductosService } from '../../services/productos.service';
import { ConfigService } from '../../services/config.service';
import { Carrito } from '../../services/carrito';
import { PromoInicio } from '../../components/promo-inicio/promo-inicio';

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [
    RouterLink,
    Header,
    Hero,
    SeccionMenu,
    Beneficios,
    BotonCarrito,
    Loading,
    Cerrado,
    Aparecer,
    PromoInicio,   // ← unificado en un solo array
  ],
  templateUrl: './tienda.html',
  styleUrl: './tienda.css',
})
export class Tienda {
  horario = inject(Horario);
  productosService = inject(ProductosService);
  private configService = inject(ConfigService);
  carrito = inject(Carrito);

  cargando = signal(true);

  constructor() {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) localStorage.setItem('ref-sabrositas', ref.trim());

    // 🛒 Si hay productos pendientes de un canje, agrégalos al carrito
    const productosPendientes = localStorage.getItem('canje_productos');
    if (productosPendientes) {
      try {
        const productos: { productoId: number; cantidad: number }[] = JSON.parse(productosPendientes);
        localStorage.removeItem('canje_productos');

        const esperarProductos = setInterval(() => {
          const catalogo = this.productosService.productos();
          if (catalogo.length > 0) {
            clearInterval(esperarProductos);
            this.carrito.agregarMultiples(productos, catalogo);
          }
        }, 200);
      } catch {}
    }

    Promise.all([
      this.configService.cargar(),
      this.productosService.cargar(),
    ]).finally(() => {
      setTimeout(() => this.cargando.set(false), 2500);
    });
  }
}
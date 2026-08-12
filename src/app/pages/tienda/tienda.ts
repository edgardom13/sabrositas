import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router'; // ← agrega esta línea
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

@Component({
  selector: 'app-tienda',
  standalone: true,
  imports: [
    RouterLink, // ← agrégalo aquí
    Header,
    Hero,
    SeccionMenu,
    Beneficios,
    BotonCarrito,
    Loading,
    Cerrado,
    Aparecer,
  ],
  templateUrl: './tienda.html',
  styleUrl: './tienda.css',
})
export class Tienda {
  horario = inject(Horario);
  productosService = inject(ProductosService);
  private configService = inject(ConfigService);

  cargando = signal(true);

  constructor() {
    // 🔗 Captura el código de referido desde la URL
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) localStorage.setItem('ref-sabrositas', ref.trim());

    Promise.all([
      this.configService.cargar(),
      this.productosService.cargar(),
    ]).finally(() => {
      setTimeout(() => this.cargando.set(false), 2500);
    });
  }
}
import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Header } from '../../components/header/header';
import { Hero } from '../../components/hero/hero';
import { SeccionMenu } from '../../components/seccion-menu/seccion-menu';
import { Beneficios } from '../../components/beneficios/beneficios';
import { BotonCarrito } from '../../components/boton-carrito/boton-carrito';
import { Cerrado } from '../../components/cerrado/cerrado';
import { Aparecer } from '../../directives/aparecer';
import { Horario } from '../../services/horario';
import { ProductosService, Producto } from '../../services/productos.service';
import { ConfigService } from '../../services/config.service';
import { Carrito } from '../../services/carrito';
import { PromoInicio } from '../../components/promo-inicio/promo-inicio';
import { ModalComboTienda } from '../../components/modal-combo-tienda/modal-combo-tienda';


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
    Cerrado,
    Aparecer,
    PromoInicio,
    ModalComboTienda 
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

  // 🆕 Todas las categorías (solo productos visibles en tienda: activo = true)
  empanadas = computed(() => this.productosService.empanadas());
  jugos = computed(() => this.productosService.jugos());
  frios = computed(() => this.productosService.frios());
  salsas = computed(() => this.productosService.salsas());
  arroces = computed(() => this.productosService.arroces());
  asaduras = computed(() => this.productosService.asaduras());
  plasticos = computed(() => this.productosService.plasticos());
  papas = computed(() => this.productosService.papas());

  // 🎁 Combos como productos virtuales (solo activos en tienda)
  // ID negativo grande para no chocar con productos reales ni Domicilio (-999)
    combosComoProductos = computed<Producto[]>(() =>
    this.productosService.combosActivos().map((c) => ({
      id: -10000 - c.id,
      nombre: c.nombre,
      precio: Number(c.precio),
      imagen: c.imagen || this.productosService.generarImagenCombo(c.nombre),
      categoria: 'combo' as any,
      orden: c.orden,
      activo: true,
      activo_pos: true,
      imagen_pos: null,
      // 🆕 Resumen: "2× Empanadas + 1× Jugos"
      detalle: (c.items || [])
        .map((i) => `${i.cantidad}× ${i.etiqueta}`)
        .join(' + '),
    } as Producto))
  );

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

    // 🆕 Cargar productos Y combos en paralelo
    Promise.all([
      this.configService.cargar(),
      this.productosService.cargar(),
      this.productosService.cargarCombos(),  // ← NUEVO
    ]).finally(() => {
      setTimeout(() => this.cargando.set(false), 2500);
    });
  }
}
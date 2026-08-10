import { Component, inject, signal } from '@angular/core';
import { Header } from './components/header/header';
import { Hero } from './components/hero/hero';
import { SeccionMenu } from './components/seccion-menu/seccion-menu';
import { Beneficios } from './components/beneficios/beneficios';
import { BotonCarrito } from './components/boton-carrito/boton-carrito';
import { Loading } from './components/loading/loading';
import { Cerrado } from './components/cerrado/cerrado';
import { Aparecer } from './directives/aparecer';
import { Horario } from './services/horario';
import { EMPANADAS, JUGOS, FRIOS } from './data/productos';

@Component({
  selector: 'app-root',
  imports: [Header, Hero, SeccionMenu, Beneficios, BotonCarrito, Loading, Cerrado, Aparecer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  horario = inject(Horario);
  empanadas = EMPANADAS;
  jugos = JUGOS;
  frios = FRIOS;

  cargando = signal(true);

  constructor() {
    // El loading dura 2.5 segundos
    setTimeout(() => this.cargando.set(false), 2500);
  }
}
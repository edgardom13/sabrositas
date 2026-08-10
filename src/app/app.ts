import { Component } from '@angular/core';
import { Header } from './components/header/header';
import { Hero } from './components/hero/hero';
import { SeccionMenu } from './components/seccion-menu/seccion-menu';
import { Beneficios } from './components/beneficios/beneficios';
import { BotonCarrito } from './components/boton-carrito/boton-carrito';
import { EMPANADAS, JUGOS } from './data/productos';

@Component({
  selector: 'app-root',
  imports: [Header, Hero, SeccionMenu, Beneficios, BotonCarrito],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  empanadas = EMPANADAS;
  jugos = JUGOS;
}
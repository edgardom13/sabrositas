import { Producto } from '../models/producto';

export const EMPANADAS: Producto[] = [
  { id: 1, nombre: 'Carne ', precio: 1000, imagen: 'img/carne.png' },
  { id: 2, nombre: 'Pollo ', precio: 1000, imagen: 'img/pollo.png' },
  { id: 3, nombre: 'Bandeja x12 Carne ', precio: 10000, imagen: 'img/bandeja.png' },
  { id: 4, nombre: 'Bandeja x12 Pollo ', precio: 10000, imagen: 'img/bandeja.png' },
];

export const JUGOS: Producto[] = [
  { id: 3, nombre: 'Agua de Maíz', precio: 2000, imagen: 'img/maiz.png' },
  { id: 4, nombre: 'Corozo',       precio: 2000, imagen: 'img/corozo.png' },
];
import { Producto } from '../models/producto';

export const EMPANADAS: Producto[] = [
  { id: 1, nombre: 'Empanadas de carne ', precio: 1500, imagen: 'img/carne.png' },
  { id: 2, nombre: 'Empanadas de pollo ', precio: 1500, imagen: 'img/pollo.png' },
];

export const JUGOS: Producto[] = [
  { id: 3, nombre: 'Agua de maíz', precio: 2000, imagen: 'img/maiz.png' },
  { id: 4, nombre: 'Corozo',       precio: 2000, imagen: 'img/corozo.png' },
];

export const FRIOS: Producto[] = [
  { id: 5, nombre: 'Bandeja empanadas de carne  x12  ', precio: 10000, imagen: 'img/bandeja.png' },
  { id: 6, nombre: 'Bandeja empanadas de pollo x12  ', precio: 10000, imagen: 'img/bandeja.png' },
];

export const SALSAS: Producto[] = [
  { id: 7, nombre: 'Salsa de tomate', precio: 0, imagen: 'img/tomate.png' },
  { id: 8, nombre: 'Salsa tartara', precio: 0, imagen: 'img/tartara.png' },
  { id: 9, nombre: 'Suero con hojita', precio: 0, imagen: 'img/suero.png' },
  { id: 10, nombre: 'Salsa rosada', precio: 0, imagen: 'img/rosada.png' },
];
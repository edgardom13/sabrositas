import { Producto } from '../models/producto';

export const EMPANADAS: Producto[] = [
  { id: 1, nombre: 'Empanadas de carne', precio: 2000, imagen: 'img/carne.png', categoria: 'otro' },
  { id: 2, nombre: 'Empanadas de pollo', precio: 2000, imagen: 'img/pollo.png', categoria: 'otro' },
];

export const JUGOS: Producto[] = [
  { id: 3, nombre: 'Agua de maíz', precio: 2000, imagen: 'img/maiz.png', categoria: 'otro' },
  { id: 4, nombre: 'Corozo',       precio: 2000, imagen: 'img/corozo.png', categoria: 'otro' },
];

export const FRIOS: Producto[] = [
  { id: 5, nombre: 'Bandeja empanadas de carne x12', precio: 20000, imagen: 'img/bandeja.png', categoria: 'otro' },
  { id: 6, nombre: 'Bandeja empanadas de pollo x12', precio: 20000, imagen: 'img/bandeja.png', categoria: 'otro' },
];

export const SALSAS: Producto[] = [
  { id: 7,  nombre: 'Salsa de tomate', precio: 500, imagen: 'img/tomate.png', categoria: 'salsa' },
  { id: 8,  nombre: 'Salsa tartara',   precio: 500, imagen: 'img/tartara.png', categoria: 'salsa' },
  { id: 9,  nombre: 'Suero con hojita',precio: 500, imagen: 'img/suero.png', categoria: 'salsa' },
  { id: 10, nombre: 'Salsa rosada',    precio: 500, imagen: 'img/rosada.png', categoria: 'salsa' },
];
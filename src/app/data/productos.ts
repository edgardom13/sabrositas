import { CategoriaProducto } from '../services/productos.service';

export const CATEGORIAS_DISPONIBLES: { valor: CategoriaProducto; etiqueta: string }[] = [
  { valor: 'empanada', etiqueta: '🥟 Empanada' },
  { valor: 'jugo', etiqueta: '🍹 Jugo' },
  { valor: 'frio', etiqueta: '🧊 Frío' },
  { valor: 'salsa', etiqueta: '🥫 Salsa' },
];

export const ETIQUETA_CATEGORIA: Record<CategoriaProducto, string> = {
  empanada: '🥟 Empanada',
  jugo: '🍹 Jugo',
  frio: '🧊 Frío',
  salsa: '🥫 Salsa',
};
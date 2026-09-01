import { CategoriaProducto } from '../services/productos.service';

export const CATEGORIAS_DISPONIBLES: { valor: CategoriaProducto; etiqueta: string }[] = [
  { valor: 'empanada', etiqueta: '🥟 Empanada' },
  { valor: 'jugo', etiqueta: '🍹 Jugo' },
  { valor: 'frio', etiqueta: '🧊 Frío' },
  { valor: 'salsa', etiqueta: '🥫 Salsa' },
  { valor: 'arroz', etiqueta: '🍚 Arroz' },
  { valor: 'asadura', etiqueta: '🥩 Asadura' },
  { valor: 'plastico', etiqueta: '🛍️ Plástico' },
  { valor: 'papa', etiqueta: '🥔 Papa' },
];

export const ETIQUETA_CATEGORIA: Record<CategoriaProducto, string> = {
  empanada: '🥟 Empanada',
  jugo: '🍹 Jugo',
  frio: '🧊 Frío',
  salsa: '🥫 Salsa',
  arroz: '🍚 Arroz',
  asadura: '🥩 Asadura',
  plastico: '🛍️ Plástico',
  papa: '🥔 Papa',
};
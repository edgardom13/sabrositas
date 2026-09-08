import { Component, inject } from '@angular/core';
import { ComboTienda } from '../../services/combo-tienda.service';
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-modal-combo-tienda',
  standalone: true,
  imports: [],
  templateUrl: './modal-combo-tienda.html',
  styleUrl: './modal-combo-tienda.css',
})
export class ModalComboTienda {
  comboTienda = inject(ComboTienda);
  productosService = inject(ProductosService);

  formatearPrecio(v: number): string {
    return '$' + Number(v || 0).toLocaleString('es-CO');
  }
}
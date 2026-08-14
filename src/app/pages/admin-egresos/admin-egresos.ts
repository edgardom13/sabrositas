import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EgresosService } from '../../services/egresos.service';

@Component({
  selector: 'app-admin-egresos',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-egresos.html',
  styleUrl: './admin-egresos.css',   // ← AGREGA ESTA LÍNEA
})
export class AdminEgresos implements OnInit {
  egresosService = inject(EgresosService);

  fecha = this.hoy();
  descripcion = '';
  categoria = 'insumos';
  monto: number | null = null;

  categorias = [
    { valor: 'insumos', etiqueta: '🥩 Insumos' },
    { valor: 'domicilios', etiqueta: '🛵 Domicilios' },
    { valor: 'servicios', etiqueta: '💡 Servicios' },
    { valor: 'personal', etiqueta: '👥 Personal' },
    { valor: 'otro', etiqueta: '📦 Otro' },
  ];

  ngOnInit(): void { this.egresosService.cargar(this.fecha); }

  cambiarFecha(valor: string): void {
    this.fecha = valor;
    this.egresosService.cargar(valor);
  }

  async guardar(): Promise<void> {
    if (!this.descripcion.trim() || !this.monto || this.monto <= 0) return;
    const ok = await this.egresosService.agregar({
      descripcion: this.descripcion.trim(),
      categoria: this.categoria,
      monto: this.monto,
      fecha: this.fecha,
    });
    if (ok) { this.descripcion = ''; this.monto = null; }
  }

  eliminar(id: number): void { this.egresosService.eliminar(id, this.fecha); }

  formatearPrecio(v: number): string { return '$' + v.toLocaleString('es-CO'); }

  private hoy(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
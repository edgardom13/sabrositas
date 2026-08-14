import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PromocionesService, PromoItem } from '../../services/promociones.service';
import { ProductosService } from '../../services/productos.service';

@Component({
  selector: 'app-admin-promociones',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './admin-promociones.html',
  styleUrl: './admin-promociones.css',   // ← AGREGA ESTA LÍNEA
})
export class AdminPromociones implements OnInit {
  promos = inject(PromocionesService);
  productosService = inject(ProductosService);

  nombre = '';
  descripcion = '';
  precio: number | null = null;
  imagenUrl = '';
  seleccion = signal<Map<number, number>>(new Map());
  subiendo = signal(false);

  ngOnInit(): void {
    this.promos.cargarTodas();
    this.productosService.cargar();
  }

  get catalogo() { return this.productosService.catalogo(); }

  cantidadDe(id: number): number { return this.seleccion().get(id) ?? 0; }

  sumar(id: number): void {
    this.seleccion.update((m) => { const n = new Map(m); n.set(id, (n.get(id) ?? 0) + 1); return n; });
  }

  restar(id: number): void {
    this.seleccion.update((m) => {
      const n = new Map(m);
      const v = (n.get(id) ?? 0) - 1;
      if (v <= 0) n.delete(id); else n.set(id, v);
      return n;
    });
  }

  get valorReal(): number {
    let t = 0;
    for (const [id, cant] of this.seleccion()) {
      const p = this.catalogo.find((x) => x.id === id);
      if (p) t += p.precio * cant;
    }
    return t;
  }

  async subirImagen(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.subiendo.set(true);
    const url = await this.promos.subirImagen(file);
    if (url) this.imagenUrl = url;
    this.subiendo.set(false);
  }

  async crear(): Promise<void> {
    if (!this.nombre.trim() || !this.precio || this.seleccion().size === 0) return;
    const productos: PromoItem[] = [...this.seleccion()].map(([productoId, cantidad]) => ({ productoId, cantidad }));
    const ok = await this.promos.crear({
      nombre: this.nombre.trim(),
      descripcion: this.descripcion.trim(),
      imagen: this.imagenUrl,
      precio: this.precio,
      productos,
      activa: true,
    });
    if (ok) {
      this.nombre = ''; this.descripcion = ''; this.precio = null;
      this.imagenUrl = ''; this.seleccion.set(new Map());
    }
  }

  toggle(id: number, activa: boolean): void { this.promos.toggle(id, !activa); }
  eliminar(id: number): void { this.promos.eliminar(id); }
  formatearPrecio(v: number): string { return '$' + v.toLocaleString('es-CO'); }
}
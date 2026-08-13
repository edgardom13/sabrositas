import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ReferidosService, Premio } from '../../services/referidos.service';
import { ProductosService } from '../../services/productos.service';

interface CanjeReciente {
  id: number;
  codigo: string;
  premio: Premio;
}

@Component({
  selector: 'app-cliente-premios',
  standalone: true,
  imports: [],
  templateUrl: './cliente-premios.html',
})
export class ClientePremios implements OnInit {
  auth = inject(AuthService);
  referidos = inject(ReferidosService);
  productosService = inject(ProductosService);
  private router = inject(Router);

  procesando = signal<number | null>(null);
  canjeReciente = signal<CanjeReciente | null>(null);
  copiadoModal = signal(false);

  ngOnInit(): void {
    this.referidos.cargarPremios();
    this.referidos.cargarCanjes();
    this.productosService.cargar();
  }

  formatearPrecio(v: number): string { return '$' + v.toLocaleString('es-CO'); }

  iconoTipo(tipo: string): string {
    const i: Record<string, string> = { empanada: '🥟', jugo: '🍹', domicilio: '🛵', monto: '💰', otro: '🎁' };
    return i[tipo ?? 'otro'] ?? '🎁';
  }

  puedeCanjear(p: Premio): boolean {
    return (this.auth.perfil()?.puntos ?? 0) >= p.puntos;
  }

  private esEsteMes(iso: string): boolean {
    const f = new Date(iso);
    const hoy = new Date();
    return f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth();
  }

  canjeadoEsteMes(premioId: number): boolean {
    return this.referidos.canjes().some(
      (c) => c.premio_id === premioId && c.estado !== 'anulado' && this.esEsteMes(c.creado_en),
    );
  }

  fechaReactivacion(): string {
    const hoy = new Date();
    const proximo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);
    return proximo.toLocaleDateString('es-CO', { day: 'numeric', month: 'long' });
  }

  botonBloqueado(p: Premio): boolean {
    return !this.puedeCanjear(p) || this.canjeadoEsteMes(p.id) || this.procesando() === p.id;
  }

  textoBoton(p: Premio): string {
    if (this.procesando() === p.id) return '⏳ Procesando…';
    if (this.canjeadoEsteMes(p.id)) return '🎟️ Canjeado este mes';
    if (!this.puedeCanjear(p)) return `Te faltan ${p.puntos - (this.auth.perfil()?.puntos ?? 0)} pts`;
    return 'Canjear ahora';
  }

  // 🎯 MAPEO POR TIPO (robusto, no depende del nombre)
  mapearPremio(p: Premio): { productoId: number; cantidad: number }[] {
    const cat = this.productosService.catalogo();
    const cant = p.cantidad ?? 1;

    if (p.tipo === 'empanada') {
      const emp = cat.find((x) => x.categoria === 'empanada');
      return emp ? [{ productoId: emp.id, cantidad: cant }] : [];
    }
    if (p.tipo === 'jugo') {
      const jugo = cat.find((x) => x.categoria === 'jugo');
      return jugo ? [{ productoId: jugo.id, cantidad: cant }] : [];
    }
    // 'monto', 'domicilio', 'otro' → no auto-agrega productos (descuento fijo o entrega física)
    return [];
  }

  async canjear(p: Premio): Promise<void> {
    this.procesando.set(p.id);
    const r = await this.referidos.canjear(p);
    this.procesando.set(null);
    if (r.ok && r.canje) {
      this.canjeReciente.set({ id: r.canje.id, codigo: r.canje.codigo, premio: p });
    }
  }

  // Para canjes YA existentes en "Mis canjes"
  abrirCanjeExistente(c: any): void {
    this.canjeReciente.set({
      id: c.id,
      codigo: c.codigo,
      premio: {
        id: c.premio_id,
        nombre: c.premio?.nombre ?? '',
        puntos: 0,
        tipo: c.premio?.tipo,
        valor: c.premio?.valor,
        cantidad: c.premio?.cantidad,
      },
    });
  }

  async copiarCodigo(): Promise<void> {
    const c = this.canjeReciente();
    if (!c) return;
    try {
      await navigator.clipboard.writeText(c.codigo);
      this.copiadoModal.set(true);
      setTimeout(() => this.copiadoModal.set(false), 2000);
    } catch {}
  }

  // 🛒 Va a la tienda con productos + canje auto-aplicado
  reclamarEnTienda(): void {
    const c = this.canjeReciente();
    if (!c) return;
    const productos = this.mapearPremio(c.premio);
    this.referidos.prepararCanjeParaTienda(c.codigo, productos);
    this.router.navigate(['/']);
  }

  cerrarModal(): void {
    this.canjeReciente.set(null);
    this.copiadoModal.set(false);
  }
}
import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { PredictivoService, PrediccionDia } from '../../services/predictivo.service';
import { SlicePipe } from '@angular/common';  // ← AGREGAR ESTA LÍNEA


@Component({
  selector: 'app-admin-predictivo',
  standalone: true,
  imports: [SlicePipe],
  templateUrl: './admin-predictivo.html',
  styleUrl: './admin-predictivo.css',
})
export class AdminPredictivo implements OnInit {
  ia = inject(PredictivoService);

  vista = signal<'semana' | number>('semana');

  async ngOnInit(): Promise<void> { await this.ia.cargar(); }

  analisis = computed(() => this.ia.analisis());
  dias = computed(() => this.analisis().dias);
  insights = computed(() => this.analisis().insights);
  horaPico = computed(() => this.analisis().horaPico);

  diaSeleccionado = computed<PrediccionDia | null>(() => {
    const v = this.vista();
    if (v === 'semana') return null;
    return this.dias().find((d) => d.dia === v) ?? null;
  });

  maxIngreso = computed(() => Math.max(1, ...this.dias().map((d) => d.ingresoEstimado)));

  ordenDias = computed(() => [1, 2, 3, 4, 5, 6, 0]); // Lunes primero

  emojiCat(c: string): string {
    const m: Record<string, string> = { empanada:'🥟', jugo:'🍹', frio:'🧊', salsa:'🥫', arroz:'🍚', asadura:'🥩', plastico:'🛍️', papa:'🥔' };
    return m[c] ?? '📦';
  }

  claseConfianza(c: string): string { return c; }

  flechaTendencia(t: number): string { return t >= 0.1 ? '📈' : t <= -0.1 ? '📉' : '➖'; }

  formatearPrecio = (v: number) => this.ia.f(v);
}
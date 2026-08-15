import { Component, inject, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { EstadisticasService, Periodo } from '../../services/estadisticas.service';

type TabId = 'ventas' | 'finanzas' | 'marketing';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.css',
})
export class Estadisticas implements OnInit {
  service = inject(EstadisticasService);
  tab = signal<TabId>('ventas');

  tabs: { id: TabId; icono: string; nombre: string }[] = [
    { id: 'ventas', icono: '📊', nombre: 'Ventas y pedidos' },
    { id: 'finanzas', icono: '💰', nombre: 'Finanzas' },
    { id: 'marketing', icono: '🎯', nombre: 'Marketing' },
  ];

  periodos: { valor: Periodo; etiqueta: string }[] = [
    { valor: 'dia', etiqueta: '📅 Hoy' },
    { valor: 'semana', etiqueta: '🗓️ Semana' },
    { valor: 'mes', etiqueta: '📆 Mes' },
    { valor: 'ano', etiqueta: '🌟 Año' },
    { valor: 'personalizado', etiqueta: '🎯 Elegir día' },
  ];

  ngOnInit(): void {
    this.service.cargar();
  }

  cambiarPeriodo(p: Periodo): void {
    this.service.periodo.set(p);
  }

  cambiarFecha(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (valor) {
      this.service.fechaElegida.set(valor);
      this.service.periodo.set('personalizado');
    }
  }

  alturaBarra(valor: number): number {
    return Math.max((valor / this.service.maxSerie()) * 100, valor > 0 ? 4 : 1);
  }

  mostrarEtiqueta(indice: number): boolean {
    const p = this.service.periodo();
    if (p === 'semana' || p === 'ano') return true;
    if (p === 'dia' || p === 'personalizado') return indice % 4 === 0;
    return indice % 5 === 0;
  }

  emojiCategoria(cat: string): string {
    const map: Record<string, string> = {
      insumos: '🥟', nomina: '👥', servicios: '💡', transporte: '🛵', marketing: '📣', otro: '📦',
    };
    return map[cat] ?? '📦';
  }
}
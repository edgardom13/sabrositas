import { Component, inject, OnInit } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { EstadisticasService, Periodo } from '../../services/estadisticas.service';

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.css',
})
export class Estadisticas implements OnInit {
  service = inject(EstadisticasService);

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
    return indice % 5 === 0; // mes
  }
}
import { Component, inject } from '@angular/core';
import { Horario } from '../../services/horario';

@Component({
  selector: 'app-cerrado',
  standalone: true,
  imports: [],
  templateUrl: './cerrado.html',
  styleUrl: './cerrado.css',
})
export class Cerrado {
  horario = inject(Horario);

  horaTexto = () => {
    const h = this.horario.horaEnColombia();
    const m = new Date().getMinutes();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
}
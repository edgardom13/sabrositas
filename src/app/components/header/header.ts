import { Component, HostListener, inject } from '@angular/core';
import { Tema } from '../../services/tema';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  menuAbierto = false;
  tema = inject(Tema);

  // Cierra el menú al hacer clic fuera de él
  @HostListener('document:click', ['$event'])
  cerrarSiClickFuera(event: MouseEvent): void {
    if (!this.menuAbierto) return;
    const elemento = event.target as HTMLElement;
    if (elemento.closest('.nav') || elemento.closest('.btn-menu')) return;
    this.menuAbierto = false;
  }

  // Navega a la sección y cierra el menú
  irA(event: Event, id: string): void {
    event.preventDefault(); // anulamos la ancla por defecto
    this.menuAbierto = false; // cerramos el menú (en móvil y escritorio)
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }
}
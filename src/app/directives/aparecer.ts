import { Directive, ElementRef, inject, OnInit } from '@angular/core';

@Directive({ selector: '[appAparecer]' })
export class Aparecer implements OnInit {
  private el = inject(ElementRef);

  ngOnInit(): void {
    const elemento = this.el.nativeElement as HTMLElement;
    elemento.classList.add('pre-animacion');

    const observador = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((entrada) => {
          if (entrada.isIntersecting) {
            elemento.classList.add('animado');
            observador.unobserve(elemento);
          }
        });
      },
      { threshold: 0.15 },
    );

    observador.observe(elemento);
  }
}
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BotonCarrito } from './boton-carrito';

describe('BotonCarrito', () => {
  let component: BotonCarrito;
  let fixture: ComponentFixture<BotonCarrito>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BotonCarrito],
    }).compileComponents();

    fixture = TestBed.createComponent(BotonCarrito);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

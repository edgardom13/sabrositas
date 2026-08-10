import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Cerrado } from './cerrado';

describe('Cerrado', () => {
  let component: Cerrado;
  let fixture: ComponentFixture<Cerrado>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cerrado],
    }).compileComponents();

    fixture = TestBed.createComponent(Cerrado);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Combo } from './combo';

describe('Combo', () => {
  let component: Combo;
  let fixture: ComponentFixture<Combo>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Combo],
    }).compileComponents();

    fixture = TestBed.createComponent(Combo);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

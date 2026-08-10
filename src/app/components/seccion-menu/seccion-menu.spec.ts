import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeccionMenu } from './seccion-menu';

describe('SeccionMenu', () => {
  let component: SeccionMenu;
  let fixture: ComponentFixture<SeccionMenu>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeccionMenu],
    }).compileComponents();

    fixture = TestBed.createComponent(SeccionMenu);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

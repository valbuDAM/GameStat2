import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RatingStarsComponent } from './rating-stars.component';

describe('RatingStarsComponent', () => {
  let fixture: ComponentFixture<RatingStarsComponent>;
  let component: RatingStarsComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [RatingStarsComponent] }).compileComponents();
    fixture = TestBed.createComponent(RatingStarsComponent);
    component = fixture.componentInstance;
  });

  it('renderiza max=10 slots por defecto', () => {
    fixture.detectChanges();
    expect(component.slots().length).toBe(10);
  });

  it('iconFor devuelve "star" si el rating cubre el slot', () => {
    component.value = 5;
    fixture.detectChanges();
    expect(component.iconFor(0)).toBe('star');
    expect(component.iconFor(4)).toBe('star');
    expect(component.iconFor(5)).toBe('star-outline');
  });

  it('soporta media estrella', () => {
    component.value = 4.5;
    fixture.detectChanges();
    expect(component.iconFor(3)).toBe('star');
    expect(component.iconFor(4)).toBe('star-half');
    expect(component.iconFor(5)).toBe('star-outline');
  });

  it('emite valueChange cuando es interactivo y el usuario clica', () => {
    component.readonly = false;
    fixture.detectChanges();
    const spy = jasmine.createSpy('emit');
    component.valueChange.subscribe(spy);
    component.onSelect(6);
    expect(spy).toHaveBeenCalledWith(7);
  });

  it('NO emite cuando es readonly', () => {
    component.readonly = true;
    fixture.detectChanges();
    const spy = jasmine.createSpy('emit');
    component.valueChange.subscribe(spy);
    component.onSelect(3);
    expect(spy).not.toHaveBeenCalled();
  });
});

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;
  let component: EmptyStateComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmptyStateComponent] }).compileComponents();
    fixture = TestBed.createComponent(EmptyStateComponent);
    component = fixture.componentInstance;
  });

  it('muestra el icono adecuado por variante', () => {
    component.variant = 'error';
    expect(component.icon()).toBe('alert-circle-outline');
    component.variant = 'offline';
    expect(component.icon()).toBe('cloud-offline-outline');
    component.variant = 'search';
    expect(component.icon()).toBe('search-outline');
    component.variant = 'empty';
    expect(component.icon()).toBe('sparkles-outline');
  });

  it('iconOverride tiene prioridad sobre variante', () => {
    component.variant = 'error';
    component.iconOverride = 'rocket-outline';
    expect(component.icon()).toBe('rocket-outline');
  });

  it('renderiza el botón CTA solo si hay actionLabel', () => {
    component.title = 'Vacío';
    component.actionLabel = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ion-button')).toBeNull();

    component.actionLabel = 'Recargar';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('ion-button')).toBeTruthy();
  });

  it('emite action cuando se clica el CTA', () => {
    component.actionLabel = 'Recargar';
    fixture.detectChanges();
    const spy = jasmine.createSpy('action');
    component.action.subscribe(spy);
    (fixture.nativeElement.querySelector('ion-button') as HTMLElement).click();
    expect(spy).toHaveBeenCalled();
  });
});

import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, Input, Output, computed, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { star, starHalf, starOutline } from 'ionicons/icons';

/**
 * Estrellas para puntuaciones en escala 1..max (default 10).
 * Modo `readonly` muestra; modo interactivo emite (value).
 * Soporta medio punto en modo readonly.
 */
@Component({
  selector: 'app-rating-stars',
  standalone: true,
  imports: [CommonModule, IonIcon],
  styles: [`
    :host { display: inline-flex; }
    .stars {
      display: inline-flex;
      gap: 2px;
      align-items: center;
      color: #fbbf24;
      font-size: var(--star-size, 18px);
    }
    .stars.interactive ion-icon { cursor: pointer; transition: transform .12s ease; }
    .stars.interactive ion-icon:hover { transform: scale(1.15); }
    .value { margin-left: 8px; color: var(--app-text-muted,#c9c0df); font-size: .85em; font-weight:600; }
  `],
  template: `
    <div class="stars" [class.interactive]="!readonly" role="img"
         [attr.aria-label]="ariaLabel()">
      <ion-icon
        *ngFor="let s of slots(); let i = index"
        [name]="iconFor(i)"
        (click)="onSelect(i)"
        (keydown.enter)="onSelect(i)"
        (mouseenter)="onHover(i)"
        (mouseleave)="onHover(null)"
        (focus)="onHover(i)"
        (blur)="onHover(null)"
        [attr.tabindex]="readonly ? null : 0">
      </ion-icon>
      <span class="value" *ngIf="showValue">{{ display() }}/{{ max }}</span>
    </div>
  `
})
export class RatingStarsComponent {
  private readonly valueSig = signal(0);
  private readonly hover = signal<number | null>(null);

  @HostBinding('style.--star-size') private starSize = '18px';

  @Input() set value(next: number) {
    const clean = Number.isFinite(next) ? next : 0;
    this.valueSig.set(clean);
  }
  get value(): number {
    return this.valueSig();
  }

  @Input() max = 10;
  @Input() readonly = true;
  @Input() showValue = false;
  @Input() set size(next: number) {
    const clean = Number.isFinite(next) ? Math.max(10, next) : 18;
    this.starSize = `${clean}px`;
  }
  @Output() valueChange = new EventEmitter<number>();

  readonly display = computed(() => this.hover() ?? this.valueSig());

  slots(): number[] {
    return Array.from({ length: this.max }, (_, i) => i + 1);
  }

  iconFor(index: number): string {
    const v = this.display();
    const pos = index + 1;
    if (v >= pos) return 'star';
    if (v >= pos - 0.5) return 'star-half';
    return 'star-outline';
  }

  ariaLabel(): string {
    return `${this.valueSig()} de ${this.max}`;
  }

  onSelect(index: number): void {
    if (this.readonly) return;
    const next = index + 1;
    this.valueSig.set(next);
    this.valueChange.emit(next);
  }

  onHover(index: number | null): void {
    if (this.readonly) return;
    this.hover.set(index === null ? null : index + 1);
  }

  constructor() {
    addIcons({ star, starHalf, starOutline });
  }
}

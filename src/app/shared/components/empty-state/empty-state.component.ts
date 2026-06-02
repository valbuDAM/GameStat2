import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  cloudOfflineOutline,
  searchOutline,
  sparklesOutline
} from 'ionicons/icons';

export type EmptyStateVariant = 'empty' | 'error' | 'offline' | 'search';

/**
 * Componente generico para mostrar estados sin datos / con error /
 * offline. Mantiene tipografia y espaciado consistentes en toda la app.
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, IonIcon, IonButton],
  styles: [`
    :host { display: block; }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      text-align: center;
      color: var(--app-text-muted, #c9c0df);
    }
    .empty-state .icon-wrap {
      width: 64px; height: 64px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: var(--app-primary-soft, rgba(167,139,250,.16));
      color: var(--app-primary, #a78bfa);
      font-size: 32px;
      margin-bottom: 4px;
    }
    .empty-state h3 { margin: 4px 0 0; color: var(--app-text, #f6f3ff); }
    .empty-state p { margin: 0; max-width: 360px; }
    .empty-state ion-button { margin-top: 12px; }
  `],
  template: `
    <div class="empty-state" role="status" aria-live="polite">
      <span class="icon-wrap"><ion-icon [name]="icon()"></ion-icon></span>
      <h3>{{ title }}</h3>
      <p *ngIf="message">{{ message }}</p>
      <ion-button *ngIf="actionLabel" fill="solid" size="default" (click)="action.emit()">
        {{ actionLabel }}
      </ion-button>
    </div>
  `
})
export class EmptyStateComponent {
  @Input() variant: EmptyStateVariant = 'empty';
  @Input() title = 'Nada por aqui todavia';
  @Input() message = '';
  @Input() actionLabel = '';
  @Input() iconOverride = '';
  @Output() action = new EventEmitter<void>();

  icon(): string {
    if (this.iconOverride) return this.iconOverride;
    switch (this.variant) {
      case 'error':   return 'alert-circle-outline';
      case 'offline': return 'cloud-offline-outline';
      case 'search':  return 'search-outline';
      default:        return 'sparkles-outline';
    }
  }

  constructor() {
    addIcons({ sparklesOutline, alertCircleOutline, cloudOfflineOutline, searchOutline });
  }
}

import { CommonModule } from '@angular/common';
import { Component, Input, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline } from 'ionicons/icons';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Avatar reutilizable. Acepta una URL o iniciales/emoji ya guardados.
 * Si `userId` esta presente y `linkToProfile` es true, envuelve el avatar
 * en un router-link a /tabs/profile/:userId.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [CommonModule, RouterLink, IonIcon],
  styles: [`
    :host { display: inline-flex; }
    .avatar {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: var(--avatar-size, 44px);
      height: var(--avatar-size, 44px);
      border-radius: 50%;
      background: var(--app-primary-soft, rgba(167,139,250,.16));
      color: var(--app-primary, #a78bfa);
      font-weight: 700;
      font-size: calc(var(--avatar-size, 44px) * 0.4);
      border: 1px solid var(--app-border, rgba(196,181,253,.18));
      overflow: hidden;
      text-decoration: none;
      transition: transform .15s ease, border-color .15s ease;
    }
    .avatar.is-link { cursor: pointer; }
    .avatar.is-link:hover { transform: scale(1.04); border-color: var(--app-primary,#a78bfa); }
    .avatar img { width: 100%; height: 100%; object-fit: cover; }
    .avatar.size-xs { --avatar-size: 24px; }
    .avatar.size-sm { --avatar-size: 32px; }
    .avatar.size-md { --avatar-size: 44px; }
    .avatar.size-lg { --avatar-size: 64px; }
    .avatar.size-xl { --avatar-size: 96px; }
  `],
  template: `
    <ng-container *ngIf="linkTarget(); else inlineTpl">
      <a class="avatar is-link" [ngClass]="'size-' + size" [routerLink]="linkTarget()"
         [attr.aria-label]="ariaLabel()">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </a>
    </ng-container>
    <ng-template #inlineTpl>
      <span class="avatar" [ngClass]="'size-' + size" [attr.aria-label]="ariaLabel()">
        <ng-container *ngTemplateOutlet="content"></ng-container>
      </span>
    </ng-template>

    <ng-template #content>
      <img *ngIf="imageUrl(); else textTpl" [src]="imageUrl()" [alt]="name || 'Avatar'" />
      <ng-template #textTpl>
        <span *ngIf="initials(); else iconTpl">{{ initials() }}</span>
        <ng-template #iconTpl><ion-icon name="person-outline"></ion-icon></ng-template>
      </ng-template>
    </ng-template>
  `
})
export class UserAvatarComponent {
  @Input() name = '';
  @Input() avatar = '';
  @Input() userId: string | null = null;
  @Input() size: AvatarSize = 'md';
  @Input() linkToProfile = false;

  readonly imageUrl = computed(() =>
    /^https?:\/\//i.test(this.avatar) ? this.avatar.trim() : null
  );

  readonly initials = computed(() => {
    if (this.imageUrl()) return '';
    const stored = this.avatar?.trim();
    if (stored) return stored.slice(0, 2).toUpperCase();
    const n = this.name?.trim();
    if (!n) return '';
    const parts = n.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || n[0].toUpperCase();
  });

  readonly linkTarget = computed(() =>
    this.linkToProfile && this.userId ? ['/tabs/profile', this.userId] : null
  );

  readonly ariaLabel = computed(() =>
    this.name ? `Avatar de ${this.name}` : 'Avatar de usuario'
  );

  constructor() {
    addIcons({ personOutline });
  }

  // Silencia el linter de "unused" sobre signal sin export.
  protected readonly _ = signal(0);
}

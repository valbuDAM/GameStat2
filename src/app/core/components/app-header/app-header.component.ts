import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { personOutline } from 'ionicons/icons';

import { AuthService } from '../../services/auth.service';

/**
 * Header superior fijo de la app. Logo a la izquierda y avatar / acceso
 * a perfil a la derecha. Se renderiza una sola vez dentro de TabsPage,
 * por encima de la navegacion principal.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonIcon],
  styleUrls: ['./app-header.component.scss'],
  template: `
    <header class="app-header">
      <a class="brand" routerLink="/tabs/home" aria-label="GameStat home">
        <span class="brand-mark" aria-hidden="true">
          <span class="brand-mark__dot"></span>
        </span>
        <span class="brand-name">GameStat</span>
      </a>

      <div class="header-spacer"></div>

      <a
        class="profile-link"
        routerLink="/tabs/profile"
        routerLinkActive="is-active"
        [routerLinkActiveOptions]="{ exact: false }"
        aria-label="Abrir perfil"
      >
        <ng-container *ngIf="initials() as letters; else iconFallback">
          <span class="avatar" [attr.title]="displayName()">{{ letters }}</span>
        </ng-container>
        <ng-template #iconFallback>
          <span class="avatar avatar--icon">
            <ion-icon name="person-outline"></ion-icon>
          </span>
        </ng-template>
      </a>
    </header>
  `
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);

  readonly user = this.auth.currentUser;

  readonly displayName = computed(() => this.user()?.name ?? 'Perfil');

  /**
   * El campo `avatar` del UserProfile guarda las iniciales (ver
   * AuthService.initials). Si en el futuro se sustituye por una URL,
   * el componente la detecta y la muestra como imagen.
   */
  readonly avatarUrl = computed(() => {
    const value = this.user()?.avatar ?? '';
    return /^https?:\/\//i.test(value) ? value : null;
  });

  readonly initials = computed(() => {
    if (this.avatarUrl()) return '';
    const stored = this.user()?.avatar?.trim();
    if (stored) return stored.slice(0, 2).toUpperCase();
    const name = this.user()?.name?.trim();
    if (!name) return '';
    const parts = name.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || name[0].toUpperCase();
  });

  constructor() {
    addIcons({ personOutline });
  }
}

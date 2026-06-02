import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gameControllerOutline, personCircleOutline } from 'ionicons/icons';

import { AuthService } from '../core/services/auth.service';

/**
 * Top bar global de la app. Aparece en todo el area /tabs:
 *   - Izquierda: branding "GameStat" + logo gaming.
 *   - Derecha: avatar del usuario actual que enlaza a su perfil.
 *
 * El componente se renderiza una unica vez en TabsPage y queda fijo
 * (position: fixed) sobre el viewport. En desktop arranca a la derecha
 * de la sidebar; en mobile ocupa todo el ancho.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, IonIcon],
  template: `
    <header class="app-header" role="banner">
      <a class="brand" routerLink="/tabs/home" aria-label="Ir al inicio de GameStat">
        <span class="brand-mark" aria-hidden="true">
          <ion-icon name="game-controller-outline"></ion-icon>
        </span>
        <span class="brand-text">
          <span class="brand-name">GameStat</span>
          <span class="brand-tag">play. review. share.</span>
        </span>
      </a>

      <div class="header-spacer"></div>

      <a
        class="profile-chip"
        routerLink="/tabs/profile"
        routerLinkActive="is-active"
        [attr.aria-label]="profileLabel()"
        title="Perfil"
      >
        @if (avatarUrl(); as url) {
          <img class="profile-avatar img" [src]="url" alt="" />
        } @else if (initials(); as init) {
          <span class="profile-avatar text" aria-hidden="true">{{ init }}</span>
        } @else {
          <span class="profile-avatar icon" aria-hidden="true">
            <ion-icon name="person-circle-outline"></ion-icon>
          </span>
        }
      </a>
    </header>
  `,
  styleUrls: ['./app-header.component.scss']
})
export class AppHeaderComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly user = computed(() => this.auth.currentUser());

  readonly avatarUrl = computed(() => {
    const value = this.user()?.avatar?.trim() ?? '';
    if (!value) return null;
    if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:')) {
      return value;
    }
    return null;
  });

  readonly initials = computed(() => {
    const value = this.user()?.avatar?.trim() ?? '';
    if (this.avatarUrl()) return null;
    if (value && value.length <= 3) return value.toUpperCase();
    const name = this.user()?.name?.trim() ?? '';
    if (!name) return null;
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('');
  });

  readonly profileLabel = computed(() => {
    const name = this.user()?.name?.trim();
    return name ? `Abrir perfil de ${name}` : 'Abrir mi perfil';
  });

  constructor() {
    addIcons({ gameControllerOutline, personCircleOutline });
  }
}

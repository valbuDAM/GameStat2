import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { gameControllerOutline, heartOutline, megaphoneOutline, peopleOutline } from 'ionicons/icons';
import { finalize } from 'rxjs';

import { RawgGame } from '../../core/models/rawg.models';
import { GamesService } from '../../core/services/games.service';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonContent,
    IonIcon,
    IonSpinner,
    IonText,
    RouterLink,
    RouterLinkActive
  ],
  styleUrls: ['./home.page.scss'],
  template: `
    <ion-content>
      <div class="page-shell page">
        <section class="surface-card intro-card">
          <div>
            <p class="eyebrow">Tu panel gamer</p>
            <h1>Empieza por lo que te gusta y GameStat te ayuda a ordenarlo.</h1>
            <p>
              Guarda juegos con el corazon, escribe reviews, compara valoraciones y mantente al
              dia con tu comunidad sin saltar entre pantallas.
            </p>
          </div>

          <div class="intro-actions">
            <ion-button [routerLink]="['/tabs/games']">Explorar juegos</ion-button>
            <ion-button fill="outline" color="primary" [routerLink]="['/tabs/review']">Escribir review</ion-button>
          </div>
        </section>

        <section class="card-grid stats-grid">
          <article class="surface-card stat-card">
            <ion-icon name="game-controller-outline"></ion-icon>
            <strong>Explora</strong>
            <p>Busca juegos y abre su ficha en un toque.</p>
          </article>
          <article class="surface-card stat-card">
            <ion-icon name="heart-outline"></ion-icon>
            <strong>Guarda</strong>
            <p>Marca favoritos y crea tu lista personal.</p>
          </article>
          <article class="surface-card stat-card">
            <ion-icon name="megaphone-outline"></ion-icon>
            <strong>Comparte</strong>
            <p>Publica opiniones y charla con otros jugadores.</p>
          </article>
          <article class="surface-card stat-card">
            <ion-icon name="people-outline"></ion-icon>
            <strong>Conecta</strong>
            <p>Ve actividad, feed y mensajes desde un solo sitio.</p>
          </article>
        </section>

        <section class="surface-card games-preview">
          <div class="preview-header">
            <div>
              <p class="eyebrow">Tendencias</p>
              <h2>Juegos populares</h2>
            </div>
            <ion-button fill="outline" [routerLink]="['/tabs/games']">Ver catalogo</ion-button>
          </div>

          <div class="games-loading" *ngIf="gamesLoading">
            <ion-spinner name="crescent"></ion-spinner>
          </div>

          <ion-text color="danger" *ngIf="gamesError">
            <p>{{ gamesError }}</p>
          </ion-text>

          <div class="games-grid" *ngIf="!gamesLoading && !gamesError && popularGames.length">
            <article class="game-tile" *ngFor="let game of popularGames; trackBy: trackByGameId">
              <img [src]="game.background_image || fallbackCover" [alt]="game.name" loading="lazy" />
              <div>
                <h3>{{ game.name }}</h3>
                <p>Rating: {{ game.rating | number: '1.1-1' }}</p>
                <p>Lanzamiento: {{ game.released || 'Sin fecha' }}</p>
              </div>
            </article>
          </div>
        </section>

        <section class="card-grid quick-links">
          <article class="surface-card quick-card">
            <h2>Nueva review</h2>
            <p>Comparte tu opinion sobre un juego, su rendimiento o una actualizacion.</p>
            <ion-button class="action-button" color="primary" expand="block" [routerLink]="['/tabs/review']" routerLinkActive="action-button-active">
              Ir a Review
            </ion-button>
          </article>
          <article class="surface-card quick-card">
            <h2>Comunidad</h2>
            <p>Entra a tus chats personales y grupales para hablar de lo que juegas.</p>
            <ion-button class="action-button" color="primary" expand="block" [routerLink]="['/tabs/social']" routerLinkActive="action-button-active">
              Ir a Social
            </ion-button>
          </article>
        </section>
      </div>
    </ion-content>
  `
})
export class HomePage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly fallbackCover = 'https://via.placeholder.com/360x220?text=Juego';
  popularGames: RawgGame[] = [];
  gamesLoading = false;
  gamesError = '';

  constructor(
    private readonly gamesService: GamesService
  ) {
    addIcons({
      gameControllerOutline,
      heartOutline,
      megaphoneOutline,
      peopleOutline
    });
  }

  ngOnInit(): void {
    this.loadPopularGames();
  }

  trackByGameId(_: number, game: RawgGame): number {
    return game.id;
  }

  private loadPopularGames(): void {
    this.gamesLoading = true;
    this.gamesError = '';

    this.gamesService
      .getPopularGames(1, 6)
      .pipe(
        finalize(() => {
          this.gamesLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (page) => {
          this.popularGames = page.items;
        },
        error: (error: Error) => {
          this.gamesError = error.message;
        }
      });
  }
}

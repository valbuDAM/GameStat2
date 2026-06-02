import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonRange,
  IonSpinner,
  IonText,
  IonTextarea
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { heart, heartOutline } from 'ionicons/icons';
import { finalize } from 'rxjs';

import { ReviewItem, ReviewStats } from '../../models';
import { RawgGameDetails } from '../../core/models/rawg.models';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { GamesService } from '../../core/services/games.service';
import { SocialService } from '../../core/services/social.service';
import { ReviewStatsCardComponent } from '../../shared/components/review-stats-card/review-stats-card.component';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonRange,
    IonSpinner,
    IonText,
    IonTextarea,
    ReviewStatsCardComponent
  ],
  styleUrls: ['./game.page.scss'],
  template: `
    <ion-content>
      <div class="page-shell page">
        <ion-button fill="clear" [routerLink]="['/tabs/games']">Volver al catalogo</ion-button>

        <section class="surface-card hero-card" *ngIf="loading">
          <ion-spinner name="crescent"></ion-spinner>
          <p>Cargando detalle del juego...</p>
        </section>

        <section class="surface-card hero-card error-card" *ngIf="errorMessage && !loading">
          <h1>No se pudo cargar el juego</h1>
          <p>{{ errorMessage }}</p>
        </section>

        <ng-container *ngIf="game && !loading">
          <section class="surface-card game-overview">
            <div class="cover-panel">
              <img [src]="game.background_image || fallbackCover" [alt]="game.name" />
            </div>

            <div class="info-panel">
              <p class="eyebrow">Ficha del juego</p>
              <h1>{{ game.name }}</h1>
              <p class="description">{{ game.description_raw || 'Sin descripcion disponible.' }}</p>

              <ion-button
                *ngIf="favorites.enabled()"
                fill="outline"
                size="small"
                [disabled]="favorites.isLoading(game.id)"
                [color]="favorites.isFavorite(game.id) ? 'danger' : 'medium'"
                (click)="toggleFavorite()">
                <ion-icon
                  slot="start"
                  [name]="favorites.isFavorite(game.id) ? 'heart' : 'heart-outline'">
                </ion-icon>
                {{ favorites.isFavorite(game.id) ? 'En favoritos' : 'Anadir a favoritos' }}
              </ion-button>
              <ion-text color="warning" *ngIf="favorites.error() as favError">
                <p class="feedback">{{ favError }}</p>
              </ion-text>

              <div class="meta-grid">
                <article class="meta-card">
                  <span>Rating</span>
                  <strong>{{ game.rating | number: '1.1-1' }}/5</strong>
                </article>
                <article class="meta-card">
                  <span>Lanzamiento</span>
                  <strong>{{ game.released || 'Sin fecha' }}</strong>
                </article>
                <article class="meta-card">
                  <span>Playtime</span>
                  <strong>{{ game.playtime || 0 }} h</strong>
                </article>
              </div>

              <div class="detail-list">
                <p *ngIf="developersText"><strong>Desarrollador:</strong> {{ developersText }}</p>
                <p *ngIf="publishersText"><strong>Publisher:</strong> {{ publishersText }}</p>
                <p *ngIf="genresText"><strong>Generos:</strong> {{ genresText }}</p>
                <p *ngIf="platformsText"><strong>Plataformas:</strong> {{ platformsText }}</p>
                <p *ngIf="game.website">
                  <strong>Web:</strong>
                  <a [href]="game.website" target="_blank" rel="noreferrer">{{ game.website }}</a>
                </p>
              </div>
            </div>
          </section>

          <section class="surface-card review-card">
            <div class="review-header">
              <p class="eyebrow">Review del videojuego</p>
              <h2>Comparte tu opinion</h2>
              <p>Guarda una resena con tu comentario y una nota del 1 al 10.</p>
            </div>

            <ion-item class="form-item">
              <ion-label position="stacked">Comentario</ion-label>
              <ion-textarea
                [(ngModel)]="form.comment"
                autoGrow="true"
                placeholder="Que te ha gustado, que falla y para quien lo recomiendas">
              </ion-textarea>
            </ion-item>

            <div class="rating-block">
              <div class="rating-head">
                <ion-text>Valoracion: {{ form.rating }}/10</ion-text>
                <div class="rating-actions">
                  <ion-button
                    fill="outline"
                    size="small"
                    [disabled]="form.rating <= 1"
                    (click)="updateRating(-1)">
                    -
                  </ion-button>
                  <ion-button
                    fill="outline"
                    size="small"
                    [disabled]="form.rating >= 10"
                    (click)="updateRating(1)">
                    +
                  </ion-button>
                </div>
              </div>
              <ion-range min="1" max="10" step="1" snaps="true" [(ngModel)]="form.rating"></ion-range>
            </div>

            <ion-button expand="block" [disabled]="saving" (click)="saveReview()">
              {{ saving ? 'Guardando review...' : 'Guardar review' }}
            </ion-button>

            <ion-text color="danger" *ngIf="reviewError">
              <p class="feedback">{{ reviewError }}</p>
            </ion-text>
            <ion-text color="success" *ngIf="reviewMessage">
              <p class="feedback">{{ reviewMessage }}</p>
            </ion-text>
          </section>

          <section class="surface-card reviews-list" *ngIf="gameReviews.length">
            <div class="section-head">
              <h2>Reviews guardadas</h2>
              <span>{{ gameReviews.length }}</span>
            </div>

            <article class="stored-review" *ngFor="let review of gameReviews">
              <div class="stored-top">
                <h3>{{ review.author }}</h3>
                <strong>{{ review.rating }}/10</strong>
              </div>
              <p>{{ review.comment }}</p>
              <span>{{ review.createdAt }}</span>
            </article>
          </section>

          <app-review-stats-card
            *ngIf="reviewStats"
            [stats]="reviewStats"
            title="Distribución de puntuaciones">
          </app-review-stats-card>
        </ng-container>
      </div>
    </ion-content>
  `
})
export class GamePage implements OnInit {
  readonly fallbackCover = 'https://via.placeholder.com/960x540?text=Juego';
  readonly favorites = inject(FavoritesService);

  game: RawgGameDetails | null = null;
  loading = true;
  saving = false;
  errorMessage = '';
  reviewError = '';
  reviewMessage = '';
  reviewStats: ReviewStats | null = null;

  form = {
    comment: '',
    rating: 8
  };

  constructor(
    private readonly route: ActivatedRoute,
    private readonly gamesService: GamesService,
    private readonly auth: AuthService,
    private readonly social: SocialService
  ) {
    addIcons({ heart, heartOutline });
  }

  toggleFavorite(): void {
    if (this.game) {
      void this.favorites.toggle(this.game);
    }
  }

  get developersText(): string {
    return this.game?.developers?.map((item) => item.name).join(', ') ?? '';
  }

  get publishersText(): string {
    return this.game?.publishers?.map((item) => item.name).join(', ') ?? '';
  }

  get genresText(): string {
    return this.game?.genres?.map((item) => item.name).join(', ') ?? '';
  }

  get platformsText(): string {
    return this.game?.platforms?.map((item) => item.platform.name).join(', ') ?? '';
  }

  get gameReviews(): ReviewItem[] {
    if (!this.game) {
      return [];
    }

    return this.social.getReviewsForGame(this.game.id, this.game.name);
  }

  ngOnInit(): void {
    const gameId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(gameId)) {
      this.loading = false;
      this.errorMessage = 'El identificador del juego no es valido.';
      return;
    }

    this.gamesService
      .getGameDetails(gameId)
      .pipe(
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe({
        next: (game) => {
          this.game = game;
          void this.loadStats(game.id);
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }

  private async loadStats(rawgId: number): Promise<void> {
    try {
      this.reviewStats = await this.social.getReviewStats(rawgId);
    } catch {
      this.reviewStats = null;
    }
  }

  async saveReview(): Promise<void> {
    const user = this.auth.currentUser();

    if (!user || !this.game) {
      this.reviewError = 'Necesitas una sesion activa para guardar la review.';
      return;
    }

    if (!this.form.comment.trim()) {
      this.reviewError = 'Escribe un comentario antes de guardar la review.';
      return;
    }

    this.reviewError = '';
    this.reviewMessage = '';
    this.saving = true;

    try {
      await this.social.addReview({
        userId: user.id,
        gameId: this.game.id,
        game: this.game.name,
        title: `Review de ${this.game.name}`,
        subtitle: '',
        comment: this.form.comment,
        rating: this.form.rating,
        author: user.name
      });

      this.form = {
        comment: '',
        rating: 8
      };
      this.reviewMessage = 'Review guardada correctamente.';
    } catch (error) {
      this.reviewError =
        error instanceof Error ? error.message : 'No se pudo guardar la review.';
    } finally {
      this.saving = false;
    }
  }

  updateRating(delta: number): void {
    this.form.rating = Math.max(1, Math.min(10, this.form.rating + delta));
  }
}

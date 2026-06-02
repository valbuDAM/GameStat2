import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonText,
  IonTextarea
} from '@ionic/angular/standalone';
import {
  Subject,
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  map,
  of,
  switchMap,
  tap
} from 'rxjs';

import { RawgGame } from '../../core/models/rawg.models';
import { AuthService } from '../../core/services/auth.service';
import { GamesService } from '../../core/services/games.service';
import { SocialService } from '../../core/services/social.service';
import { RatingStarsComponent } from '../../shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RatingStarsComponent,
    IonButton,
    IonContent,
    IonInput,
    IonItem,
    IonLabel,
    IonList,
    IonSpinner,
    IonText,
    IonTextarea
  ],
  styleUrls: ['./review.page.scss'],
  template: `
    <ion-content [scrollY]="false">
      <div class="page-shell page">
        <section class="surface-card form-card">
          <h1>Nueva review</h1>
          <div class="review-fields">
            <div class="game-field">
              <ion-item>
                <ion-label position="stacked">Juego</ion-label>
                <ion-input
                  [(ngModel)]="form.game"
                  autocomplete="off"
                  (ngModelChange)="onGameInput($event)">
                </ion-input>
              </ion-item>

              <div class="game-suggestions" *ngIf="showGameSuggestions()">
                <button
                  type="button"
                  class="game-suggestion"
                  *ngFor="let game of gameSuggestions; trackBy: trackByGameId"
                  (click)="selectGame(game)">
                  <span class="game-title">{{ game.name }}</span>
                  <span class="game-meta">{{ game.released || 'Sin fecha' }}</span>
                </button>

                <div class="suggestion-state" *ngIf="gameSearchLoading">
                  <ion-spinner name="crescent"></ion-spinner>
                  <span>Buscando juegos...</span>
                </div>

                <div class="suggestion-state" *ngIf="!gameSearchLoading && !gameSuggestions.length && !gameSearchError">
                  No hay juegos con ese nombre.
                </div>

                <div class="suggestion-state error" *ngIf="gameSearchError">
                  {{ gameSearchError }}
                </div>
              </div>
            </div>
            <ion-item>
              <ion-label position="stacked">Titulo</ion-label>
              <ion-input [(ngModel)]="form.title" placeholder="Tu titular para la review"></ion-input>
            </ion-item>
          </div>

          <div class="rating-row">
            <ion-text class="rating-label">Valoración: {{ form.rating }}/10</ion-text>
            <app-rating-stars
              [value]="form.rating"
              [readonly]="false"
              [showValue]="false"
              [max]="10"
              (valueChange)="form.rating = $event">
            </app-rating-stars>
          </div>

          <ion-item class="comment-field">
            <ion-label position="stacked">Comentario</ion-label>
            <ion-textarea [(ngModel)]="form.comment" autoGrow="true" rows="3"></ion-textarea>
          </ion-item>

          <div class="submit-row">
            <ion-button [disabled]="saving" (click)="addReview()">
              {{ saving ? 'Guardando...' : 'Guardar review' }}
            </ion-button>
          </div>

          <ion-text color="danger" *ngIf="errorMessage">
            <p>{{ errorMessage }}</p>
          </ion-text>
        </section>

        <section class="surface-card review-section">
          <header class="section-header">
            <div>
              <p class="eyebrow">Reviews</p>
              <h2>Ultimas opiniones</h2>
            </div>
            <span>{{ social.reviews().length }}</span>
          </header>

          <div class="review-scroll app-scroll">
            <ion-list class="review-list">
              <ion-item
                lines="none"
                button
                [routerLink]="['/tabs/review', review.id]"
                *ngFor="let review of social.reviews()">
                <ion-label>
                  <h2>{{ review.game }} - {{ review.rating }}/10</h2>
                  <h3>{{ review.title }}</h3>
                  <p>{{ review.comment }}</p>
                  <p>{{ review.author }} - {{ review.createdAt }}</p>
                </ion-label>
              </ion-item>
            </ion-list>
          </div>
        </section>
      </div>
    </ion-content>
  `
})
export class ReviewPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly gameSearchTerms$ = new Subject<string>();

  form = {
    game: '',
    title: '',
    comment: '',
    rating: 7
  };
  saving = false;
  errorMessage = '';
  selectedGame: RawgGame | null = null;
  gameSuggestions: RawgGame[] = [];
  gameSearchLoading = false;
  gameSearchError = '';
  gameSuggestionsOpen = false;

  constructor(
    public readonly social: SocialService,
    private readonly auth: AuthService,
    private readonly gamesService: GamesService
  ) {
    this.setupGameSearchStream();
  }

  onGameInput(value: string): void {
    const cleanValue = value.trim();

    if (this.selectedGame?.name !== cleanValue) {
      this.selectedGame = null;
    }

    this.gameSuggestionsOpen = cleanValue.length >= 2;
    this.gameSearchTerms$.next(cleanValue);
  }

  selectGame(game: RawgGame): void {
    this.selectedGame = game;
    this.form.game = game.name;
    this.gameSuggestions = [];
    this.gameSearchError = '';
    this.gameSuggestionsOpen = false;
  }

  showGameSuggestions(): boolean {
    return (
      this.gameSuggestionsOpen &&
      Boolean(this.form.game.trim()) &&
      !this.selectedGame
    );
  }

  trackByGameId(_: number, game: RawgGame): number {
    return game.id;
  }

  async addReview(): Promise<void> {
    const user = this.auth.currentUser();
    if (
      !user ||
      !this.form.game.trim() ||
      !this.form.title.trim() ||
      !this.form.comment.trim()
    ) {
      return;
    }

    if (!this.selectedGame) {
      this.errorMessage = 'Selecciona un juego del desplegable para confirmar que existe.';
      return;
    }

    this.errorMessage = '';
    this.saving = true;

    try {
      await this.social.addReview({
        userId: user.id,
        gameId: this.selectedGame.id,
        game: this.selectedGame.name,
        title: this.form.title,
        comment: this.form.comment,
        rating: this.form.rating,
        author: user.name
      });

      this.form = {
        game: '',
        title: '',
        comment: '',
        rating: 7
      };
      this.selectedGame = null;
      this.gameSuggestions = [];
      this.gameSuggestionsOpen = false;
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'No se pudo guardar la review.';
    } finally {
      this.saving = false;
    }
  }

  private setupGameSearchStream(): void {
    this.gameSearchTerms$
      .pipe(
        map((term) => term.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => {
          this.gameSearchError = '';

          if (term.length < 2) {
            this.gameSuggestions = [];
            this.gameSearchLoading = false;
            this.gameSuggestionsOpen = false;
            return;
          }

          this.gameSearchLoading = true;
        }),
        switchMap((term) => {
          if (term.length < 2) {
            return of([]);
          }

          return this.gamesService.searchGames(term, 1, 8).pipe(
            map((page) => page.items),
            catchError((error: Error) => {
              this.gameSearchError = error.message;
              return of([]);
            }),
            finalize(() => {
              this.gameSearchLoading = false;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((games) => {
        this.gameSuggestions = games;
      });
  }
}

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar
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

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonButton,
    IonContent,
    IonHeader,
    IonInput,
    IonItem,
    IonLabel,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar
  ],
  styleUrls: ['./register.page.scss'],
  template: `
    <ion-header translucent="true">
      <ion-toolbar>
        <ion-title>GameStat</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content [fullscreen]="true">
      <div class="page-shell auth-layout">
        <section class="surface-card auth-hero">
          <div class="hero-inner">
            <p class="eyebrow">GAMESTAT</p>
            <h1>Empieza hoy y manten el foco</h1>
            <p class="lead">Crea tu cuenta, configura tus perfil y descubre una forma mas divertida compartir y hablar con tus amigos.</p>

            <div class="hero-badges">
              <span class="badge">Configura en minutos</span>
              <span class="badge">Comparte logros</span>
              <span class="badge">Todo en una app</span>
            </div>
          </div>
        </section>

        <section class="surface-card auth-card">
          <form (ngSubmit)="submit()">
            <h2>Crea tu cuenta</h2>
            <p class="helper">Empieza a registrar tus juegos, compartir tus gustos y encontrar gente con tu misma afición.</p>

            <div class="form-fields">
              <ion-item class="form-item">
                <ion-label position="stacked">Nick</ion-label>
                <ion-input [(ngModel)]="form.name" name="name" autocomplete="nickname"></ion-input>
              </ion-item>
              <ion-item class="form-item">
                <ion-label position="stacked">Email</ion-label>
                <ion-input [(ngModel)]="form.email" name="email" type="email" autocomplete="email"></ion-input>
              </ion-item>
              <ion-item class="form-item">
                <ion-label position="stacked">Contraseña</ion-label>
                <ion-input [(ngModel)]="form.password" name="password" type="password" autocomplete="new-password"></ion-input>
              </ion-item>
              <ion-item class="form-item">
                <ion-label position="stacked">Repite contraseña</ion-label>
                <ion-input name="confirmPassword" type="password" autocomplete="new-password"></ion-input>
              </ion-item>
              <div class="favorite-game-field">
                <ion-item class="form-item">
                  <ion-label position="stacked">Juego favorito</ion-label>
                  <ion-input
                    [(ngModel)]="form.favoriteGame"
                    name="favoriteGame"
                    autocomplete="off"
                    (ngModelChange)="onFavoriteGameInput($event)">
                  </ion-input>
                </ion-item>

                <div class="game-suggestions" *ngIf="showFavoriteGameSuggestions()">
                  <button
                    type="button"
                    class="game-suggestion"
                    *ngFor="let game of favoriteGameSuggestions; trackBy: trackByGameId"
                    (click)="selectFavoriteGame(game)">
                    <span class="game-title">{{ game.name }}</span>
                    <span class="game-meta">{{ game.released || 'Sin fecha' }}</span>
                  </button>

                  <div class="suggestion-state" *ngIf="favoriteGameSearchLoading">
                    <ion-spinner name="crescent"></ion-spinner>
                    <span>Buscando juegos...</span>
                  </div>

                  <div class="suggestion-state" *ngIf="!favoriteGameSearchLoading && !favoriteGameSuggestions.length && !favoriteGameSearchError">
                    No hay juegos con ese nombre.
                  </div>

                  <div class="suggestion-state error" *ngIf="favoriteGameSearchError">
                    {{ favoriteGameSearchError }}
                  </div>
                </div>
              </div>
            </div>

            <ion-button expand="block" class="primary-gradient" type="submit" [disabled]="loading">
              {{ loading ? 'Creando cuenta...' : 'Registrarme' }}
            </ion-button>
          </form>

          <ion-text color="success" *ngIf="message">
            <p class="feedback">{{ message }}</p>
          </ion-text>
          <ion-text color="danger" *ngIf="error">
            <p class="feedback">{{ error }}</p>
          </ion-text>

          <p class="muted">Ya tienes cuenta? <a routerLink="/login">Inicia sesion</a></p>
        </section>
      </div>
    </ion-content>
  `
})
export class RegisterPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly favoriteGameSearchTerms$ = new Subject<string>();

  form = {
    name: '',
    email: '',
    password: '',
    favoriteGame: '',
    bio: ''
  };
  error = '';
  message = '';
  loading = false;
  selectedFavoriteGame: RawgGame | null = null;
  favoriteGameSuggestions: RawgGame[] = [];
  favoriteGameSearchLoading = false;
  favoriteGameSearchError = '';
  favoriteGameSuggestionsOpen = false;

  constructor(
    private readonly auth: AuthService,
    private readonly router: Router,
    private readonly gamesService: GamesService
  ) {
    this.setupFavoriteGameSearch();
  }

  onFavoriteGameInput(value: string): void {
    const cleanValue = value.trim();

    if (this.selectedFavoriteGame?.name !== cleanValue) {
      this.selectedFavoriteGame = null;
    }

    this.favoriteGameSuggestionsOpen = cleanValue.length >= 2;
    this.favoriteGameSearchTerms$.next(cleanValue);
  }

  selectFavoriteGame(game: RawgGame): void {
    this.selectedFavoriteGame = game;
    this.form.favoriteGame = game.name;
    this.favoriteGameSuggestions = [];
    this.favoriteGameSearchError = '';
    this.favoriteGameSuggestionsOpen = false;
  }

  showFavoriteGameSuggestions(): boolean {
    return (
      this.favoriteGameSuggestionsOpen &&
      Boolean(this.form.favoriteGame.trim()) &&
      !this.selectedFavoriteGame
    );
  }

  trackByGameId(_: number, game: RawgGame): number {
    return game.id;
  }

  async submit(): Promise<void> {
    this.error = '';
    this.message = '';

    if (!this.selectedFavoriteGame) {
      this.error = 'Selecciona tu juego favorito del desplegable para confirmar que existe.';
      return;
    }

    this.loading = true;

    try {
      const result = await this.auth.register(this.form);

      if (result.requiresEmailConfirmation) {
        this.form.password = '';
        this.message =
          'Cuenta creada. Revisa tu email para confirmar la cuenta antes de iniciar sesion.';
        return;
      }

      await this.router.navigateByUrl('/tabs/home');
    } catch (error) {
      this.error = error instanceof Error ? error.message : 'No se pudo crear la cuenta.';
    } finally {
      this.loading = false;
    }
  }

  private setupFavoriteGameSearch(): void {
    this.favoriteGameSearchTerms$
      .pipe(
        map((term) => term.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => {
          this.favoriteGameSearchError = '';

          if (term.length < 2) {
            this.favoriteGameSuggestions = [];
            this.favoriteGameSearchLoading = false;
            this.favoriteGameSuggestionsOpen = false;
            return;
          }

          this.favoriteGameSearchLoading = true;
        }),
        switchMap((term) => {
          if (term.length < 2) {
            return of([]);
          }

          return this.gamesService.searchGames(term, 1, 8).pipe(
            map((page) => page.items),
            catchError((error: Error) => {
              this.favoriteGameSearchError = error.message;
              return of([]);
            }),
            finalize(() => {
              this.favoriteGameSearchLoading = false;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((games) => {
        this.favoriteGameSuggestions = games;
      });
  }
}

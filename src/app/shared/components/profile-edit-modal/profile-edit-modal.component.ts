import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cameraOutline,
  closeOutline,
  saveOutline,
  trashOutline
} from 'ionicons/icons';
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

import { RawgGame } from '../../../core/models/rawg.models';
import { UserProfile } from '../../../models';
import { AuthService } from '../../../core/services/auth.service';
import { GamesService } from '../../../core/services/games.service';
import { StorageService } from '../../../core/services/storage.service';
import { UserAvatarComponent } from '../user-avatar/user-avatar.component';

@Component({
  selector: 'app-profile-edit-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonContent,
    IonHeader,
    IonIcon,
    IonInput,
    IonItem,
    IonLabel,
    IonSpinner,
    IonText,
    IonTextarea,
    IonTitle,
    IonToolbar,
    UserAvatarComponent
  ],
  template: `
    <ion-header>
      <ion-toolbar color="dark">
        <ion-title>Editar perfil</ion-title>
        <ion-button fill="clear" slot="end" (click)="cancel()" aria-label="Cerrar">
          <ion-icon slot="icon-only" name="close-outline"></ion-icon>
        </ion-button>
      </ion-toolbar>
    </ion-header>

    <ion-content class="modal-content">
      <div class="modal-shell">

        <section class="avatar-section">
          <app-user-avatar
            size="xl"
            [name]="form.name"
            [avatar]="previewAvatar() || form.avatar">
          </app-user-avatar>

          <div class="avatar-actions">
            <ion-button fill="solid" color="primary" (click)="fileInput.click()" [disabled]="uploading()">
              <ion-icon slot="start" name="camera-outline"></ion-icon>
              {{ uploading() ? 'Subiendo...' : (hasImage() ? 'Cambiar foto' : 'Subir foto') }}
            </ion-button>
            <ion-button
              fill="clear"
              color="danger"
              *ngIf="hasImage() && !uploading()"
              (click)="removeAvatar()">
              <ion-icon slot="start" name="trash-outline"></ion-icon>
              Quitar foto
            </ion-button>
            <input
              #fileInput
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              (change)="onFileSelected($event)" />
          </div>
          <p class="hint">PNG, JPG, WEBP o GIF. Maximo 4 MB.</p>
        </section>

        <section class="fields">
          <ion-item lines="full">
            <ion-label position="stacked">Nombre</ion-label>
            <ion-input [(ngModel)]="form.name" maxlength="60" autocapitalize="words"></ion-input>
          </ion-item>

          <div class="favorite-game-field">
            <ion-item lines="full">
              <ion-label position="stacked">Juego favorito</ion-label>
              <ion-input
                [(ngModel)]="form.favoriteGame"
                autocomplete="off"
                (ngModelChange)="onFavoriteGameInput($event)">
              </ion-input>
            </ion-item>

            <div class="game-suggestions" *ngIf="showSuggestions()">
              <button
                type="button"
                class="game-suggestion"
                *ngFor="let game of suggestions(); trackBy: trackByGameId"
                (click)="selectFavoriteGame(game)">
                <span class="game-title">{{ game.name }}</span>
                <span class="game-meta">{{ game.released || 'Sin fecha' }}</span>
              </button>

              <div class="suggestion-state" *ngIf="searchLoading()">
                <ion-spinner name="crescent"></ion-spinner>
                <span>Buscando juegos...</span>
              </div>

              <div
                class="suggestion-state"
                *ngIf="!searchLoading() && suggestions().length === 0 && !searchError()">
                No hay juegos con ese nombre.
              </div>

              <div class="suggestion-state error" *ngIf="searchError()">
                {{ searchError() }}
              </div>
            </div>
          </div>

          <ion-item lines="full">
            <ion-label position="stacked">Bio</ion-label>
            <ion-textarea
              [(ngModel)]="form.bio"
              autoGrow="true"
              [maxlength]="500"
              placeholder="Cuentanos algo sobre ti...">
            </ion-textarea>
          </ion-item>
        </section>

        <ion-text color="danger" *ngIf="error()">
          <p class="error-msg">{{ error() }}</p>
        </ion-text>

        <div class="actions">
          <ion-button expand="block" fill="outline" color="medium" (click)="cancel()" [disabled]="saving()">
            Cancelar
          </ion-button>
          <ion-button expand="block" color="primary" (click)="save()" [disabled]="saving() || uploading()">
            <ion-icon slot="start" name="save-outline"></ion-icon>
            {{ saving() ? 'Guardando...' : 'Guardar cambios' }}
          </ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    ion-header ion-toolbar {
      --background: rgba(16, 15, 29, 0.96);
      --color: var(--app-text);
    }

    .modal-content {
      --background: linear-gradient(180deg, #0c0a18, #15112a);
    }

    .modal-shell {
      max-width: 560px;
      margin: 0 auto;
      padding: 22px 18px 32px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }

    .avatar-section {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 18px;
      background: rgba(42, 37, 70, 0.55);
      border: 1px solid var(--app-border);
      border-radius: 18px;
    }

    .avatar-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .hint {
      margin: 0;
      color: var(--app-text-soft);
      font-size: 12px;
    }

    .fields {
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: rgba(42, 37, 70, 0.55);
      border: 1px solid var(--app-border);
      border-radius: 18px;
      padding: 6px 4px;
    }

    .fields ion-item {
      --background: transparent;
      --color: var(--app-text);
      --border-color: rgba(196, 181, 253, 0.16);
    }

    .favorite-game-field {
      position: relative;
    }

    .game-suggestions {
      margin: 6px 8px 8px;
      background: rgba(20, 18, 35, 0.92);
      border: 1px solid var(--app-border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 240px;
      overflow-y: auto;
    }

    .game-suggestion {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      padding: 10px 14px;
      background: transparent;
      border: none;
      color: var(--app-text);
      cursor: pointer;
      text-align: left;
      border-bottom: 1px solid rgba(196, 181, 253, 0.08);
    }
    .game-suggestion:last-child { border-bottom: none; }
    .game-suggestion:hover { background: rgba(167, 139, 250, 0.12); }

    .game-title { font-weight: 600; }
    .game-meta { font-size: 11px; color: var(--app-text-soft); }

    .suggestion-state {
      padding: 10px 14px;
      color: var(--app-text-soft);
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .suggestion-state.error { color: #f87171; }

    .error-msg {
      margin: 0;
      padding: 10px 12px;
      background: rgba(220, 38, 38, 0.12);
      border: 1px solid rgba(248, 113, 113, 0.4);
      border-radius: 10px;
      font-size: 13px;
    }

    .actions {
      display: grid;
      grid-template-columns: 1fr 1.2fr;
      gap: 10px;
      margin-top: 4px;
    }

    @media (max-width: 480px) {
      .actions { grid-template-columns: 1fr; }
    }
  `]
})
export class ProfileEditModalComponent implements OnInit {
  @Input() profile!: UserProfile;

  private readonly destroyRef = inject(DestroyRef);
  private readonly modalCtrl = inject(ModalController);
  private readonly auth = inject(AuthService);
  private readonly games = inject(GamesService);
  private readonly storage = inject(StorageService);

  private readonly searchTerms$ = new Subject<string>();

  form = {
    name: '',
    favoriteGame: '',
    bio: '',
    avatar: ''
  };
  private originalFavoriteGame = '';
  private selectedGame: RawgGame | null = null;
  private pendingAvatarFile: File | null = null;
  private removeAvatarRequested = false;

  readonly previewAvatar = signal<string>('');
  readonly suggestions = signal<RawgGame[]>([]);
  readonly searchLoading = signal(false);
  readonly searchError = signal('');
  readonly suggestionsOpen = signal(false);
  readonly uploading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');

  readonly hasImage = computed(() => {
    const av = this.previewAvatar() || this.form.avatar;
    return /^https?:\/\//i.test(av) || /^data:/i.test(av);
  });

  readonly showSuggestions = computed(() =>
    this.suggestionsOpen() &&
    this.form.favoriteGame.trim().length > 0 &&
    !this.selectedGame
  );

  constructor() {
    addIcons({ cameraOutline, closeOutline, saveOutline, trashOutline });
  }

  ngOnInit(): void {
    this.form.name = this.profile.name;
    this.form.favoriteGame = this.profile.favoriteGame;
    this.form.bio = this.profile.bio;
    this.form.avatar = this.profile.avatar;
    this.originalFavoriteGame = this.profile.favoriteGame;

    this.searchTerms$
      .pipe(
        map((term) => term.trim()),
        debounceTime(300),
        distinctUntilChanged(),
        tap((term) => {
          this.searchError.set('');
          if (term.length < 2) {
            this.suggestions.set([]);
            this.searchLoading.set(false);
            this.suggestionsOpen.set(false);
            return;
          }
          this.searchLoading.set(true);
        }),
        switchMap((term) => {
          if (term.length < 2) return of([]);
          return this.games.searchGames(term, 1, 8).pipe(
            map((page) => page.items),
            catchError((err: Error) => {
              this.searchError.set(err.message);
              return of([]);
            }),
            finalize(() => this.searchLoading.set(false))
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((games) => this.suggestions.set(games));
  }

  trackByGameId(_: number, g: RawgGame): number {
    return g.id;
  }

  onFavoriteGameInput(value: string): void {
    const v = value.trim();
    if (this.selectedGame?.name !== v) this.selectedGame = null;
    this.suggestionsOpen.set(v.length >= 2);
    this.searchTerms$.next(v);
  }

  selectFavoriteGame(game: RawgGame): void {
    this.selectedGame = game;
    this.form.favoriteGame = game.name;
    this.suggestions.set([]);
    this.searchError.set('');
    this.suggestionsOpen.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (file.size > 4 * 1024 * 1024) {
      this.error.set('La imagen no puede superar 4 MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.error.set('Solo se admiten archivos de imagen.');
      return;
    }

    this.error.set('');
    this.pendingAvatarFile = file;
    this.removeAvatarRequested = false;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewAvatar.set(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    this.pendingAvatarFile = null;
    this.removeAvatarRequested = true;
    this.previewAvatar.set('');
    this.form.avatar = '';
  }

  async cancel(): Promise<void> {
    await this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.error.set('');

    const cleanName = this.form.name.trim();
    if (!cleanName) {
      this.error.set('El nombre no puede estar vacio.');
      return;
    }

    const cleanFavoriteGame = this.form.favoriteGame.trim();
    const favoriteGameChanged =
      cleanFavoriteGame.toLowerCase() !== this.originalFavoriteGame.trim().toLowerCase();
    if (favoriteGameChanged && cleanFavoriteGame && !this.selectedGame) {
      this.error.set('Selecciona el juego favorito del desplegable para confirmar que existe.');
      return;
    }

    this.saving.set(true);
    try {
      let avatarValue = this.form.avatar;

      if (this.pendingAvatarFile) {
        this.uploading.set(true);
        try {
          avatarValue = await this.storage.uploadAvatar(
            this.profile.id,
            this.pendingAvatarFile
          );
        } finally {
          this.uploading.set(false);
        }
      } else if (this.removeAvatarRequested) {
        avatarValue = '';
      }

      await this.auth.updateProfile({
        name: cleanName,
        favoriteGame: cleanFavoriteGame,
        bio: this.form.bio,
        avatar: avatarValue
      });

      await this.modalCtrl.dismiss({ saved: true }, 'save');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo guardar el perfil.');
    } finally {
      this.saving.set(false);
    }
  }
}

import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';

import { RawgGame } from '../models/rawg.models';
import { AuthService } from './auth.service';
import { GamesService } from './games.service';

@Injectable({ providedIn: 'root' })
export class FavoritesService {
  private readonly auth = inject(AuthService);
  private readonly games = inject(GamesService);

  private readonly idsState = signal<ReadonlySet<number>>(new Set());
  private readonly loadingIdsState = signal<ReadonlySet<number>>(new Set());
  private readonly listLoadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly ids = computed(() => this.idsState());
  readonly count = computed(() => this.idsState().size);
  readonly listLoading = this.listLoadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly enabled = computed(() => this.games.favoritesEnabled());

  constructor() {
    // Recarga favoritos cuando cambia el usuario autenticado.
    effect(() => {
      const user = this.auth.currentUser();
      if (user && this.enabled()) {
        void this.refresh(user.id);
      } else {
        this.idsState.set(new Set());
        this.loadingIdsState.set(new Set());
        this.errorState.set(null);
      }
    });
  }

  isFavorite(gameId: number): boolean {
    return this.idsState().has(gameId);
  }

  isLoading(gameId: number): boolean {
    return this.loadingIdsState().has(gameId);
  }

  async refresh(userId?: string): Promise<void> {
    const uid = userId ?? this.auth.currentUser()?.id;
    if (!uid || !this.enabled()) {
      return;
    }

    this.listLoadingState.set(true);
    this.errorState.set(null);
    try {
      const ids = await firstValueFrom(this.games.getFavoriteGames(uid));
      this.idsState.set(new Set(ids));
    } catch (err) {
      this.errorState.set(err instanceof Error ? err.message : 'No se pudieron cargar los favoritos.');
    } finally {
      this.listLoadingState.set(false);
    }
  }

  /** Aplica un toggle con actualizacion optimista y rollback en caso de error. */
  async toggle(game: RawgGame): Promise<void> {
    if (!this.enabled()) {
      this.errorState.set('Supabase no esta configurado. Revisa src/environments/environment.ts.');
      return;
    }
    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      this.errorState.set('Inicia sesion para guardar favoritos.');
      return;
    }

    const wasFavorite = this.isFavorite(game.id);
    this.markLoading(game.id, true);
    this.errorState.set(null);

    // Optimistic update.
    this.idsState.update((set) => {
      const next = new Set(set);
      if (wasFavorite) {
        next.delete(game.id);
      } else {
        next.add(game.id);
      }
      return next;
    });

    const request$: Observable<void> = wasFavorite
      ? this.games.removeFavoriteGame(userId, game.id)
      : this.games.saveFavoriteGame(userId, game);

    try {
      await firstValueFrom(request$);
    } catch (err) {
      // Rollback.
      this.idsState.update((set) => {
        const next = new Set(set);
        if (wasFavorite) {
          next.add(game.id);
        } else {
          next.delete(game.id);
        }
        return next;
      });
      this.errorState.set(
        err instanceof Error ? err.message : 'No se pudo actualizar el favorito.'
      );
    } finally {
      this.markLoading(game.id, false);
    }
  }

  clearError(): void {
    this.errorState.set(null);
  }

  private markLoading(gameId: number, loading: boolean): void {
    this.loadingIdsState.update((set) => {
      const next = new Set(set);
      if (loading) {
        next.add(gameId);
      } else {
        next.delete(gameId);
      }
      return next;
    });
  }
}

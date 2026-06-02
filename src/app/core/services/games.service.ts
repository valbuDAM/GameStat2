import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  BehaviorSubject,
  Observable,
  catchError,
  defer,
  distinctUntilChanged,
  finalize,
  from,
  map,
  of,
  shareReplay,
  throwError
} from 'rxjs';

import { environment } from '../../../environments/environment';
import {
  FavoriteGameRow,
  RawgGame,
  RawgGameDetails,
  RawgGamesPage,
  RawgPaginatedResponse
} from '../models/rawg.models';
import { SupabaseService } from './supabase.service';

type RawgParamValue = string | number | boolean | null | undefined;

interface FavoriteGameIdRow {
  rawg_id: number;
}

@Injectable({ providedIn: 'root' })
export class GamesService {
  private readonly apiUrl = environment.rawg.apiUrl.replace(/\/$/, '');
  private readonly apiKey = environment.rawg.apiKey.trim();
  private readonly defaultPageSize = environment.rawg.pageSize;
  private readonly supabaseSyncEnabledByConfig = Boolean(environment.rawg.syncWithSupabase);

  private readonly pendingRequestsState = new BehaviorSubject(0);
  private readonly lastErrorState = new BehaviorSubject<string | null>(null);

  readonly loading$ = this.pendingRequestsState.pipe(
    map((pending) => pending > 0),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  readonly error$ = this.lastErrorState.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly supabaseService: SupabaseService
  ) {}

  /** Catalogo publico (tabla rawg_games). Requiere flag de entorno. */
  supportsSupabaseSync(): boolean {
    return this.supabaseSyncEnabledByConfig && this.supabaseService.isConfigured;
  }

  /** Favoritos por usuario. Solo requiere Supabase configurado. */
  favoritesEnabled(): boolean {
    return this.supabaseService.isConfigured;
  }

  getPopularGames(page = 1, pageSize = this.defaultPageSize): Observable<RawgGamesPage> {
    return this.fetchGames({
      page,
      page_size: pageSize,
      ordering: '-added'
    });
  }

  searchGames(query: string, page = 1, pageSize = this.defaultPageSize): Observable<RawgGamesPage> {
    const cleanQuery = query.trim();

    if (!cleanQuery) {
      return this.getPopularGames(page, pageSize);
    }

    return this.fetchGames({
      search: cleanQuery,
      search_precise: true,
      page,
      page_size: pageSize
    });
  }

  getGameDetails(id: number): Observable<RawgGameDetails> {
    return this.get<RawgGameDetails>(`/games/${id}`).pipe(
      catchError((error) =>
        this.handleHttpError(error, 'No se pudo cargar el detalle del videojuego.')
      )
    );
  }

  getFavoriteGames(userId: string): Observable<number[]> {
    if (!this.favoritesEnabled()) {
      return of([]);
    }

    return defer(() => {
      const client = this.requireSupabaseClient();

      return from(
        client
          .from('favorite_games')
          .select('rawg_id')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      );
    }).pipe(
      map(({ data, error }) => {
        if (error) {
          throw new Error(this.mapSupabaseError(error.message));
        }

        return (data as FavoriteGameIdRow[] | null)?.map((item) => item.rawg_id) ?? [];
      }),
      catchError((error) =>
        this.handlePlainError(error, 'No se pudieron cargar los favoritos desde Supabase.')
      )
    );
  }

  getFavoriteGamesWithDetails(userId: string): Observable<RawgGame[]> {
    if (!this.favoritesEnabled()) {
      return of([]);
    }

    return defer(() => {
      const client = this.requireSupabaseClient();

      return from(
        client
          .from('favorite_games')
          .select('rawg_id, name, background_image, rating, released')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
      );
    }).pipe(
      map(({ data, error }) => {
        if (error) {
          throw new Error(this.mapSupabaseError(error.message));
        }

        return (data as Array<{ rawg_id: number; name: string; background_image?: string; rating?: number; released?: string }> | null)?.map((item) => ({
          id: item.rawg_id,
          name: item.name,
          background_image: item.background_image || null,
          rating: item.rating || 0,
          ratings_count: 0,
          metacritic: null,
          released: item.released || null,
          slug: item.name.toLowerCase().replace(/\s+/g, '-'),
          genres: [],
          platforms: []
        } as RawgGame)) ?? [];
      }),
      catchError((error) =>
        this.handlePlainError(error, 'No se pudieron cargar los favoritos desde Supabase.')
      )
    );
  }

  saveFavoriteGame(userId: string, game: RawgGame): Observable<void> {
    if (!this.favoritesEnabled()) {
      return of(void 0);
    }

    const payload: FavoriteGameRow = {
      user_id: userId,
      rawg_id: game.id,
      name: game.name,
      background_image: game.background_image,
      rating: game.rating,
      released: game.released
    };

    return defer(() => {
      const client = this.requireSupabaseClient();

      return from(
        client.from('favorite_games').upsert(payload, {
          onConflict: 'user_id,rawg_id'
        })
      );
    }).pipe(
      map(({ error }) => {
        if (error) {
          throw new Error(this.mapSupabaseError(error.message));
        }

        return void 0;
      }),
      catchError((error) =>
        this.handlePlainError(error, 'No se pudo guardar el favorito en Supabase.')
      )
    );
  }

  removeFavoriteGame(userId: string, rawgId: number): Observable<void> {
    if (!this.favoritesEnabled()) {
      return of(void 0);
    }

    return defer(() => {
      const client = this.requireSupabaseClient();

      return from(
        client
          .from('favorite_games')
          .delete()
          .eq('user_id', userId)
          .eq('rawg_id', rawgId)
      );
    }).pipe(
      map(({ error }) => {
        if (error) {
          throw new Error(this.mapSupabaseError(error.message));
        }

        return void 0;
      }),
      catchError((error) =>
        this.handlePlainError(error, 'No se pudo eliminar el favorito de Supabase.')
      )
    );
  }

  syncGamesWithSupabase(games: RawgGame[]): Observable<void> {
    if (!games.length || !this.supportsSupabaseSync()) {
      return of(void 0);
    }

    return defer(() => {
      const client = this.requireSupabaseClient();
      const payload = games.map((game) => ({
        rawg_id: game.id,
        name: game.name,
        background_image: game.background_image,
        rating: game.rating,
        released: game.released
      }));

      return from(
        client.from('rawg_games').upsert(payload, {
          onConflict: 'rawg_id'
        })
      );
    }).pipe(
      map(({ error }) => {
        if (error) {
          throw new Error(this.mapSupabaseError(error.message));
        }

        return void 0;
      }),
      catchError((error) =>
        this.handlePlainError(error, 'No se pudo sincronizar el catalogo con Supabase.')
      )
    );
  }

  private fetchGames(params: Record<string, RawgParamValue>): Observable<RawgGamesPage> {
    const page = Number(params.page ?? 1);
    const pageSize = Number(params.page_size ?? this.defaultPageSize);

    return this.get<RawgPaginatedResponse<RawgGame>>('/games', params).pipe(
      map((response) => ({
        items: response.results,
        count: response.count,
        page,
        pageSize,
        next: response.next,
        previous: response.previous,
        hasNextPage: Boolean(response.next)
      })),
      catchError((error) =>
        this.handleHttpError(error, 'No se pudo cargar el catalogo de videojuegos.')
      )
    );
  }

  private get<T>(path: string, params: Record<string, RawgParamValue> = {}): Observable<T> {
    if (!this.apiKey || this.apiKey.startsWith('REEMPLAZA_')) {
      return this.handlePlainError(
        new Error('Falta configurar RAWG API key en src/environments/environment.ts.'),
        'Falta configurar RAWG API key en src/environments/environment.ts.'
      );
    }

    return defer(() => {
      this.pendingRequestsState.next(this.pendingRequestsState.value + 1);
      this.lastErrorState.next(null);

      return this.http
        .get<T>(`${this.apiUrl}${path}`, {
          params: this.buildParams(params)
        })
        .pipe(
          finalize(() => {
            this.pendingRequestsState.next(Math.max(0, this.pendingRequestsState.value - 1));
          })
        );
    });
  }

  private buildParams(params: Record<string, RawgParamValue>): HttpParams {
    let httpParams = new HttpParams().set('key', this.apiKey);

    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }

      httpParams = httpParams.set(key, String(value));
    }

    return httpParams;
  }

  private requireSupabaseClient() {
    const client = this.supabaseService.client;

    if (!client) {
      throw new Error(
        'Supabase no esta configurado. Revisa src/environments/environment.ts antes de usar favoritos.'
      );
    }

    return client;
  }

  private handleHttpError(error: unknown, fallbackMessage: string): Observable<never> {
    if (error instanceof Error && error.message.includes('Falta configurar RAWG API key')) {
      this.lastErrorState.next(error.message);
      return throwError(() => error);
    }

    const message = this.mapHttpError(error, fallbackMessage);
    this.lastErrorState.next(message);

    return throwError(() => new Error(message));
  }

  private handlePlainError(error: unknown, fallbackMessage: string): Observable<never> {
    const message = error instanceof Error ? error.message : fallbackMessage;
    this.lastErrorState.next(message);

    return throwError(() => new Error(message));
  }

  private mapHttpError(error: unknown, fallbackMessage: string): string {
    if (!(error instanceof HttpErrorResponse)) {
      return fallbackMessage;
    }

    if (error.status === 0) {
      return 'No hay conexion con RAWG. Revisa tu red e intentalo de nuevo.';
    }

    if (error.status === 401 || error.status === 403) {
      return 'RAWG rechazo la API key. Verifica la clave en environment.ts.';
    }

    if (error.status === 429) {
      return 'RAWG limito temporalmente las requests. Espera unos segundos.';
    }

    if (typeof error.error === 'object' && error.error && 'detail' in error.error) {
      const detail = (error.error as { detail?: unknown }).detail;

      if (typeof detail === 'string' && detail.trim()) {
        return detail.trim();
      }
    }

    return fallbackMessage;
  }

  private mapSupabaseError(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('favorite_games')) {
      return 'La tabla public.favorite_games no existe. Ejecuta supabase/rawg_games.sql.';
    }

    if (normalized.includes('rawg_games')) {
      return 'La tabla public.rawg_games no existe. Ejecuta supabase/rawg_games.sql.';
    }

    if (normalized.includes('row-level security')) {
      return 'La politica RLS de Supabase no permite esta operacion.';
    }

    return message;
  }
}

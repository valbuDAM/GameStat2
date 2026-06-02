import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonSearchbar,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';
import { InfiniteScrollCustomEvent, SearchbarCustomEvent } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { calendarOutline, heart, heartOutline, starOutline } from 'ionicons/icons';
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

import { RawgGame, RawgGamesPage } from '../../core/models/rawg.models';
import { AuthService } from '../../core/services/auth.service';
import { FavoritesService } from '../../core/services/favorites.service';
import { GamesService } from '../../core/services/games.service';
import { EmptyStateComponent } from '../../shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    IonButton,
    IonContent,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonSearchbar,
    IonSpinner,
    IonText,
    EmptyStateComponent
  ],
  styleUrls: ['./games.page.scss'],
  templateUrl: './games.page.html'
})
export class GamesPage implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchTerms$ = new Subject<string>();
  readonly favorites = inject(FavoritesService);

  readonly fallbackCover = 'https://via.placeholder.com/400x240?text=Sin+imagen';

  searchTerm = '';
  games: RawgGame[] = [];

  isLoading = false;
  isLoadingMore = false;
  hasNextPage = true;
  currentPage = 1;
  errorMessage = '';

  constructor(
    private readonly gamesService: GamesService,
    private readonly authService: AuthService,
    private readonly router: Router
  ) {
    addIcons({
      starOutline,
      calendarOutline,
      heart,
      heartOutline
    });

    this.setupSearchStream();
  }

  ngOnInit(): void {
    this.searchTerms$.next('');
  }

  onSearchInput(event: SearchbarCustomEvent): void {
    this.searchTerms$.next(event.detail.value ?? '');
  }

  openGame(gameId: number): void {
    void this.router.navigate(['/tabs/game', gameId]);
  }

  loadMore(event: InfiniteScrollCustomEvent): void {
    if (!this.hasNextPage || this.isLoading || this.isLoadingMore) {
      event.target.complete();
      return;
    }

    this.isLoadingMore = true;
    const nextPage = this.currentPage + 1;

    this.fetchGames(this.searchTerm, nextPage)
      .pipe(
        finalize(() => {
          this.isLoadingMore = false;
          event.target.complete();
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (page) => {
          this.games = [...this.games, ...page.items];
          this.currentPage = page.page;
          this.hasNextPage = page.hasNextPage;
          event.target.disabled = !this.hasNextPage;

          void this.syncGamesWithSupabase(page.items);
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }

  retry(): void {
    this.errorMessage = '';
    this.isLoading = true;

    this.fetchGames(this.searchTerm, 1)
      .pipe(
        finalize(() => {
          this.isLoading = false;
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (page) => {
          this.games = page.items;
          this.currentPage = page.page;
          this.hasNextPage = page.hasNextPage;
          void this.syncGamesWithSupabase(page.items);
        },
        error: (error: Error) => {
          this.errorMessage = error.message;
        }
      });
  }

  toggleFavorite(game: RawgGame): void {
    void this.favorites.toggle(game);
  }

  isFavorite(gameId: number): boolean {
    return this.favorites.isFavorite(gameId);
  }

  isFavoriteLoading(gameId: number): boolean {
    return this.favorites.isLoading(gameId);
  }

  retryFavorites(): void {
    this.favorites.clearError();
    void this.favorites.refresh();
  }

  trackByGameId(_: number, game: RawgGame): number {
    return game.id;
  }

  private setupSearchStream(): void {
    this.searchTerms$
      .pipe(
        map((term) => term.trim()),
        debounceTime(350),
        distinctUntilChanged(),
        tap((term) => {
          this.searchTerm = term;
          this.currentPage = 1;
          this.hasNextPage = true;
          this.errorMessage = '';
          this.games = [];
          this.isLoading = true;
        }),
        switchMap((term) =>
          this.fetchGames(term, 1).pipe(
            catchError((error: Error) => {
              this.errorMessage = error.message;
              return of(this.emptyPage());
            }),
            finalize(() => {
              this.isLoading = false;
            })
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((page) => {
        this.games = page.items;
        this.currentPage = page.page;
        this.hasNextPage = page.hasNextPage;

        void this.syncGamesWithSupabase(page.items);
      });
  }

  private fetchGames(query: string, page: number) {
    return query
      ? this.gamesService.searchGames(query, page)
      : this.gamesService.getPopularGames(page);
  }

  private emptyPage(): RawgGamesPage {
    return {
      items: [],
      count: 0,
      page: 1,
      pageSize: 20,
      next: null,
      previous: null,
      hasNextPage: false
    };
  }

  private syncGamesWithSupabase(games: RawgGame[]): void {
    if (!this.gamesService.supportsSupabaseSync() || !games.length || !this.authService.currentUser()) {
      return;
    }

    this.gamesService
      .syncGamesWithSupabase(games)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: () => {
          // Mantiene la sincronizacion como opcion no bloqueante para la UX.
        }
      });
  }
}

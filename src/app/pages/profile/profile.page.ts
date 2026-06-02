import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonButton,
  IonBadge,
  IonContent,
  IonIcon,
  IonSpinner,
  IonSegment,
  IonSegmentButton,
  IonText,
  IonToast,
  ModalController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleEllipsesOutline,
  createOutline,
  logOutOutline,
  personAddOutline,
  personRemoveOutline,
  star,
  trashOutline
} from 'ionicons/icons';

import { RawgGame } from '../../core/models/rawg.models';
import { FollowStats, ProfileSummary, ReviewItem, SocialPost, UserProfile } from '../../models';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { FollowService } from '../../core/services/follow.service';
import { GamesService } from '../../core/services/games.service';
import { ProfileService } from '../../core/services/profile.service';
import { SocialService } from '../../core/services/social.service';
import { ProfileEditModalComponent } from '../../shared/components/profile-edit-modal/profile-edit-modal.component';
import { UserAvatarComponent } from '../../shared/components/user-avatar/user-avatar.component';

type ActivityEntry =
  | (SocialPost & { kind: 'post' })
  | (ReviewItem & { kind: 'review' });

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonButton,
    IonBadge,
    IonContent,
    IonIcon,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    IonText,
    IonToast,
    UserAvatarComponent
  ],
  styleUrls: ['./profile.page.scss'],
  template: `
    <ion-content>
      <div class="page-shell page">

        <section class="surface-card profile-card" *ngIf="profile() as p">
          <app-user-avatar size="xl" [name]="p.name" [avatar]="p.avatar"></app-user-avatar>
          <h1>{{ p.name }}</h1>
          <p class="muted" *ngIf="isMine()">{{ p.email }}</p>
          <ion-text color="medium">Juego favorito: {{ p.favoriteGame || '—' }}</ion-text>
          <p class="bio">{{ p.bio }}</p>

          <div class="stats">
            <button type="button" class="stat-btn" (click)="openFollowList('followers')" aria-label="Ver seguidores">
              <strong>{{ stats().followers }}</strong><span>Followers</span>
            </button>
            <button type="button" class="stat-btn" (click)="openFollowList('following')" aria-label="Ver seguidos">
              <strong>{{ stats().following }}</strong><span>Following</span>
            </button>
            <div><strong>{{ userPosts().length }}</strong><span>Posts</span></div>
            <div><strong>{{ userReviews().length }}</strong><span>Reviews</span></div>
          </div>

          <div class="actions" *ngIf="isMine()">
            <ion-button fill="solid" color="primary" (click)="openEditModal()">
              <ion-icon slot="start" name="create-outline"></ion-icon>
              Editar perfil
            </ion-button>
            <ion-button fill="outline" color="danger" (click)="logout()">
              <ion-icon slot="start" name="log-out-outline"></ion-icon>
              Cerrar sesion
            </ion-button>
          </div>

          <div class="actions" *ngIf="!isMine()">
            <ion-button
              [fill]="stats().isFollowing ? 'outline' : 'solid'"
              [color]="stats().isFollowing ? 'medium' : 'primary'"
              (click)="toggleFollow()">
              <ion-icon
                slot="start"
                [name]="stats().isFollowing ? 'person-remove-outline' : 'person-add-outline'">
              </ion-icon>
              {{ stats().isFollowing ? 'Siguiendo' : 'Seguir' }}
            </ion-button>
            <ion-button color="primary" (click)="openChat()">
              <ion-icon slot="start" name="chatbubble-ellipses-outline"></ion-icon>
              Mensaje
            </ion-button>
          </div>
        </section>

        <section class="surface-card followers-card" *ngIf="followListOpen()">
          <header class="follow-header">
            <h2>{{ followListOpen() === 'followers' ? 'Seguidores' : 'Siguiendo' }}</h2>
            <ion-button fill="clear" color="medium" (click)="closeFollowList()" aria-label="Cerrar lista">
              Cerrar
            </ion-button>
          </header>

          <div class="loading" *ngIf="followListLoading()">
            <ion-spinner name="crescent"></ion-spinner>
          </div>

          <ion-text color="medium" *ngIf="!followListLoading() && followListItems().length === 0">
            <p class="empty">No hay usuarios para mostrar.</p>
          </ion-text>

          <ul class="follow-list">
            <li *ngFor="let u of followListItems(); trackBy: trackByFollow">
              <a [routerLink]="['/tabs/profile', u.id]" class="follow-row">
                <app-user-avatar size="sm" [name]="u.name" [avatar]="u.avatar"></app-user-avatar>
                <span class="follow-info">
                  <strong>{{ u.name }}</strong>
                  <small *ngIf="u.bio">{{ u.bio }}</small>
                </span>
              </a>
            </li>
          </ul>

          <ion-button
            *ngIf="followListHasMore()"
            fill="outline"
            expand="block"
            (click)="loadMoreFollows()"
            [disabled]="followListLoading()">
            Cargar más
          </ion-button>
        </section>

        <section class="surface-card activity-card" *ngIf="activity().length">
          <div class="activity-top">
            <div>
              <h2>Actividad</h2>
              <p class="activity-subtitle">Posts y reviews en una sola vista, con filtro rápido.</p>
            </div>
            <ion-segment [value]="activityFilter()" (ionChange)="setActivityFilter($event)">
              <ion-segment-button value="all">Todo</ion-segment-button>
              <ion-segment-button value="posts">Posts</ion-segment-button>
              <ion-segment-button value="reviews">Reviews</ion-segment-button>
            </ion-segment>
          </div>

          <div class="activity-list">
            <article class="activity-item" *ngFor="let item of activityShown(); trackBy: trackByActivity">
              <header [class.post-item]="item.kind === 'post'" [class.review-item]="item.kind === 'review'">
                <ion-badge [color]="item.kind === 'review' ? 'secondary' : 'primary'">
                  {{ item.kind === 'review' ? 'Review' : 'Post' }}
                </ion-badge>
                <strong *ngIf="item.kind === 'post'">{{ item.author }}</strong>
                <strong *ngIf="item.kind === 'review'">{{ item.game }} · {{ item.rating }}/10</strong>
                <small>{{ item.createdAt }}</small>
                <ion-button
                  *ngIf="isMine()"
                  fill="clear"
                  color="medium"
                  class="activity-delete"
                  (click)="confirmDelete(item)"
                  [attr.aria-label]="item.kind === 'post' ? 'Borrar post' : 'Borrar review'">
                  <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                </ion-button>
              </header>

              <p *ngIf="item.kind === 'post'">{{ item.content }}</p>
              <p *ngIf="item.kind === 'review'">{{ item.comment }}</p>

              <footer *ngIf="item.kind === 'post'" class="activity-meta">
                <small>{{ item.likes }} likes · {{ item.comments }} comentarios</small>
              </footer>
              <footer *ngIf="item.kind === 'review'" class="activity-meta review-meta">
                <ion-icon name="star"></ion-icon>
                <small>Reseña publicada</small>
              </footer>
            </article>
          </div>
        </section>

        <section class="surface-card favorites-card">
          <div class="favorites-header">
            <div>
              <h2>Juegos Favoritos</h2>
              <p class="activity-subtitle">Coleccion de juegos guardados.</p>
            </div>
            <span class="favorite-count" *ngIf="favoriteGames().length > 0">{{ favoriteGames().length }}</span>
          </div>

          <div class="favorites-grid" *ngIf="favoriteGames().length > 0">
            <article
              class="favorite-game-item"
              *ngFor="let game of favoriteGames(); trackBy: trackByGameId"
              [routerLink]="['/tabs/game', game.id]">
              <div class="game-cover">
                <img
                  [src]="game.background_image || 'https://via.placeholder.com/400x240?text=Sin+imagen'"
                  [alt]="game.name"
                  loading="lazy" />
              </div>
              <div class="game-info">
                <h3>{{ game.name }}</h3>
                <div class="game-meta">
                  <span *ngIf="game.rating > 0" class="rating">
                    <ion-icon name="star"></ion-icon>
                    {{ game.rating | number: '1.1-1' }}
                  </span>
                  <span *ngIf="game.released" class="released">{{ game.released }}</span>
                </div>
              </div>
            </article>
          </div>

          <div class="empty-favorites" *ngIf="favoriteGames().length === 0">
            <p>Aun no hay juegos guardados como favoritos.</p>
            <p class="subtitle">Guarda juegos desde la pagina de juegos usando el icono de corazon.</p>
          </div>
        </section>

        <div class="loading" *ngIf="loading()">
          <ion-spinner name="crescent"></ion-spinner>
        </div>
      </div>

      <ion-toast
        [isOpen]="showSavedToast"
        message="Perfil actualizado."
        color="success"
        duration="1800"
        (didDismiss)="showSavedToast = false">
      </ion-toast>
    </ion-content>
  `
})
export class ProfilePage implements OnInit {
  readonly profile = signal<UserProfile | null>(null);
  readonly userPosts = signal<SocialPost[]>([]);
  readonly userReviews = signal<ReviewItem[]>([]);
  readonly favoriteGames = signal<RawgGame[]>([]);
  readonly activity = signal<ActivityEntry[]>([]);
  readonly activityFilter = signal<'all' | 'posts' | 'reviews'>('all');
  readonly activityShown = computed(() => {
    const filter = this.activityFilter();
    const items = this.activity();
    if (filter === 'posts') return items.filter((item) => item.kind === 'post');
    if (filter === 'reviews') return items.filter((item) => item.kind === 'review');
    return items;
  });
  readonly hasFavoriteGames = computed(() => this.favoriteGames().length > 0);
  readonly stats = signal<FollowStats>({ followers: 0, following: 0, isFollowing: false });
  readonly loading = signal(false);
  readonly error = signal('');

  // ---- Panel de seguidores/siguiendo ----
  readonly followListOpen = signal<'followers' | 'following' | null>(null);
  readonly followListItems = signal<ProfileSummary[]>([]);
  readonly followListLoading = signal(false);
  readonly followListHasMore = signal(false);
  private followListOffset = 0;
  private readonly FOLLOW_PAGE = 20;
  readonly isMine = computed(() => {
    const me = this.auth.currentUser();
    return !!me && me.id === this.profile()?.id;
  });

  saving = false;
  showSavedToast = false;

  constructor(
    private readonly auth: AuthService,
    private readonly profiles: ProfileService,
    private readonly social: SocialService,
    private readonly follows: FollowService,
    private readonly gamesService: GamesService,
    private readonly chat: ChatService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
    private readonly modalCtrl: ModalController
  ) {
    addIcons({
      personAddOutline,
      personRemoveOutline,
      chatbubbleEllipsesOutline,
      createOutline,
      logOutOutline,
      star,
      trashOutline
    });
  }

  async ngOnInit(): Promise<void> {
    this.route.paramMap.subscribe(async (params) => {
      const userId = params.get('userId');
      await this.loadProfile(userId);
    });
  }

  trackByGameId(_: number, game: RawgGame): number {
    return game.id;
  }

  trackByActivity(_: number, item: ActivityEntry): string {
    return `${item.kind}:${item.id}`;
  }

  setActivityFilter(event: CustomEvent): void {
    const value = event.detail?.value;
    if (value === 'all' || value === 'posts' || value === 'reviews') {
      this.activityFilter.set(value);
    }
  }

  private async loadProfile(userId: string | null): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      let target: UserProfile | null = null;
      if (!userId) {
        await this.auth.waitUntilReady();
        target = this.auth.currentUser();
      } else {
        target = await this.profiles.getProfile(userId);
      }
      if (!target) {
        this.error.set('Perfil no encontrado.');
        this.profile.set(null);
        return;
      }
      this.profile.set(target);

      const [posts, reviews, stats, favs] = await Promise.all([
        this.social.getPostsByUser(target.id),
        this.social.getReviewsForUser(target.id),
        this.follows.getStats(target.id),
        this.gamesService.getFavoriteGamesWithDetails(target.id).toPromise().catch(() => [])
      ]);
      this.userPosts.set(posts);
      this.userReviews.set(reviews);
      this.favoriteGames.set(favs || []);
      this.activity.set([
        ...posts.map((post) => ({ ...post, kind: 'post' as const })),
        ...reviews.map((review) => ({ ...review, kind: 'review' as const }))
      ].sort((a, b) => (b.createdAtTimestamp ?? Date.now()) - (a.createdAtTimestamp ?? Date.now())));
      this.stats.set(stats);
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cargar el perfil.');
    } finally {
      this.loading.set(false);
    }
  }

  async toggleFollow(): Promise<void> {
    const target = this.profile();
    if (!target) return;
    try {
      if (this.stats().isFollowing) {
        await this.follows.unfollow(target.id);
      } else {
        await this.follows.follow(target.id);
      }
      this.stats.set(await this.follows.getStats(target.id));
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'Error', 'danger');
    }
  }

  async confirmDelete(item: ActivityEntry): Promise<void> {
    if (!this.isMine()) return;

    const kindLabel = item.kind === 'post' ? 'post' : 'review';
    const alert = await this.alertCtrl.create({
      header: `Borrar ${kindLabel}`,
      message: `¿Seguro que quieres borrar este ${kindLabel}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar',
          role: 'destructive',
          handler: async () => {
            try {
              if (item.kind === 'post') {
                await this.social.deletePost(item.id);
                this.userPosts.update((items) => items.filter((p) => p.id !== item.id));
              } else {
                await this.social.deleteReview(item.id);
                this.userReviews.update((items) => items.filter((r) => r.id !== item.id));
              }
              this.activity.update((items) =>
                items.filter((entry) => !(entry.id === item.id && entry.kind === item.kind))
              );
              await this.toast(item.kind === 'post' ? 'Post borrado.' : 'Review borrada.');
            } catch (e) {
              await this.toast(
                e instanceof Error ? e.message : `No se pudo borrar el ${kindLabel}.`,
                'danger'
              );
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async openChat(): Promise<void> {
    const target = this.profile();
    if (!target) return;
    try {
      const id = await this.chat.getOrCreatePrivateConversation(target.id);
      await this.router.navigate(['/tabs/social/chat', id]);
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'Error', 'danger');
    }
  }

  async openFollowList(kind: 'followers' | 'following'): Promise<void> {
    const target = this.profile();
    if (!target) return;
    this.followListOpen.set(kind);
    this.followListItems.set([]);
    this.followListOffset = 0;
    this.followListHasMore.set(false);
    await this.loadMoreFollows();
  }

  closeFollowList(): void {
    this.followListOpen.set(null);
    this.followListItems.set([]);
    this.followListOffset = 0;
  }

  async loadMoreFollows(): Promise<void> {
    const kind = this.followListOpen();
    const target = this.profile();
    if (!kind || !target) return;
    this.followListLoading.set(true);
    try {
      const items =
        kind === 'followers'
          ? await this.follows.listFollowers(target.id, this.FOLLOW_PAGE, this.followListOffset)
          : await this.follows.listFollowing(target.id, this.FOLLOW_PAGE, this.followListOffset);
      this.followListItems.update((prev) => [...prev, ...items]);
      this.followListOffset += items.length;
      this.followListHasMore.set(items.length === this.FOLLOW_PAGE);
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'Error', 'danger');
    } finally {
      this.followListLoading.set(false);
    }
  }

  trackByFollow(_: number, p: ProfileSummary): string {
    return p.id;
  }

  initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((it) => it[0]?.toUpperCase() ?? '')
      .join('');
  }

  async save(): Promise<void> {
    // Conservado por compatibilidad; ahora guardar se hace desde el modal.
    await this.openEditModal();
  }

  async openEditModal(): Promise<void> {
    const current = this.profile();
    if (!current || !this.isMine()) return;

    const modal = await this.modalCtrl.create({
      component: ProfileEditModalComponent,
      componentProps: { profile: current },
      backdropDismiss: false,
      cssClass: 'profile-edit-modal'
    });
    await modal.present();
    const { data, role } = await modal.onWillDismiss();
    if (role === 'save' && data?.saved) {
      const updated = this.auth.currentUser();
      if (updated) this.profile.set(updated);
      this.showSavedToast = true;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.auth.logout();
      await this.router.navigateByUrl('/login');
    } catch (e) {
      this.error.set(e instanceof Error ? e.message : 'No se pudo cerrar sesion.');
    }
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}

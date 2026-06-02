import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AlertController,
  AnimationController,
  IonButton,
  IonContent,
  IonIcon,
  IonInfiniteScroll,
  IonInfiniteScrollContent,
  IonInput,
  IonItem,
  IonList,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
  ToastController,
  InfiniteScrollCustomEvent
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  chatbubbleOutline,
  heart,
  heartOutline,
  refreshOutline,
  trashOutline
} from 'ionicons/icons';

import { SocialComment, SocialPost } from '../../models';
import { AuthService } from '../../core/services/auth.service';
import { SocialService } from '../../core/services/social.service';
import { PlatformService } from '../../core/services/platform.service';
import {
  EmptyStateComponent,
  TimeAgoPipe,
  UserAvatarComponent,
  fadeInUp
} from '../../shared';

@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonButton,
    IonContent,
    IonIcon,
    IonInfiniteScroll,
    IonInfiniteScrollContent,
    IonInput,
    IonItem,
    IonList,
    IonSkeletonText,
    IonSpinner,
    IonTextarea,
    UserAvatarComponent,
    EmptyStateComponent,
    TimeAgoPipe
  ],
  styleUrls: ['./feed.page.scss'],
  template: `
    <ion-content>
      <div class="page-shell feed-shell">

        <section class="surface-card composer-card">
          <header class="feed-header">
            <p class="eyebrow">Feed social</p>
            <h1>Comparte con tu comunidad</h1>
          </header>
          <ion-item lines="none">
            <ion-textarea
              [(ngModel)]="postContent"
              placeholder="¿Qué estás jugando hoy?"
              autoGrow="true"
              maxlength="500"
              aria-label="Contenido del nuevo post">
            </ion-textarea>
          </ion-item>
          <div class="actions">
            <span class="char-count" aria-live="polite">{{ postContent.length }}/500</span>
            <ion-button
              (click)="publishPost()"
              [disabled]="publishing() || !postContent.trim()">
              {{ publishing() ? 'Publicando…' : 'Publicar' }}
            </ion-button>
          </div>
        </section>

        <section class="surface-card feed-list-card">
          <header class="feed-header">
            <h2>Últimos posts</h2>
            <ion-button fill="clear" (click)="refresh()" aria-label="Recargar feed">
              <ion-icon slot="icon-only" name="refresh-outline"></ion-icon>
            </ion-button>
          </header>

          <!-- Skeletons mientras carga la primera vez -->
          <div *ngIf="social.loadingPosts() && social.posts().length === 0" class="skeletons">
            <article class="post-card skeleton" *ngFor="let s of [0,1,2]">
              <header>
                <ion-skeleton-text animated style="width:44px;height:44px;border-radius:50%"></ion-skeleton-text>
                <div class="meta">
                  <ion-skeleton-text animated style="width:40%"></ion-skeleton-text>
                  <ion-skeleton-text animated style="width:25%"></ion-skeleton-text>
                </div>
              </header>
              <ion-skeleton-text animated style="width:95%"></ion-skeleton-text>
              <ion-skeleton-text animated style="width:80%"></ion-skeleton-text>
            </article>
          </div>

          <!-- Empty state -->
          <app-empty-state
            *ngIf="!social.loadingPosts() && social.posts().length === 0"
            variant="empty"
            title="Aún no hay posts"
            message="Sé el primero en compartir algo con la comunidad."
            actionLabel="Recargar"
            (action)="refresh()">
          </app-empty-state>

          <ion-list lines="none" class="posts app-scroll" *ngIf="social.posts().length > 0">
            <article
              #postCard
              class="post-card"
              *ngFor="let post of social.posts(); trackBy: trackById"
              [class.pending]="post.pending">
              <header>
                <app-user-avatar
                  [name]="post.author"
                  [avatar]="post.authorAvatar"
                  [userId]="post.userId"
                  size="md"
                  [linkToProfile]="true">
                </app-user-avatar>
                <div class="meta">
                  <strong>{{ post.author }}</strong>
                  <span>{{ post.createdAtTimestamp | timeAgo }}</span>
                </div>
                <ion-button
                  fill="clear"
                  color="medium"
                  *ngIf="post.userId === currentUserId()"
                  (click)="deletePost(post)"
                  aria-label="Borrar post">
                  <ion-icon slot="icon-only" name="trash-outline"></ion-icon>
                </ion-button>
              </header>
              <p class="content">{{ post.content }}</p>
              <footer>
                <ion-button
                  fill="clear"
                  size="small"
                  (click)="toggleLike(post)"
                  [attr.aria-pressed]="post.liked"
                  [attr.aria-label]="post.liked ? 'Quitar like' : 'Dar like'">
                  <ion-icon
                    slot="start"
                    [name]="post.liked ? 'heart' : 'heart-outline'"
                    [color]="post.liked ? 'danger' : 'medium'">
                  </ion-icon>
                  {{ post.likes }}
                </ion-button>
                <ion-button
                  fill="clear"
                  size="small"
                  (click)="toggleComments(post)"
                  aria-label="Comentarios">
                  <ion-icon slot="start" name="chatbubble-outline"></ion-icon>
                  {{ post.comments }}
                </ion-button>
              </footer>

              <div class="comments" *ngIf="openedCommentsFor() === post.id">
                <div class="loading" *ngIf="loadingComments()">
                  <ion-spinner name="crescent"></ion-spinner>
                </div>
                <article class="comment" *ngFor="let c of commentsList()">
                  <app-user-avatar
                    [name]="c.author"
                    [avatar]="c.authorAvatar"
                    size="sm">
                  </app-user-avatar>
                  <div>
                    <strong>{{ c.author }}</strong>
                    <small>{{ c.createdAt }}</small>
                    <p>{{ c.content }}</p>
                  </div>
                </article>
                <ion-item lines="none" class="comment-composer">
                  <ion-input
                    [(ngModel)]="commentDraft"
                    placeholder="Escribe un comentario…"
                    aria-label="Nuevo comentario"
                    (keydown.enter)="submitComment(post)">
                  </ion-input>
                  <ion-button slot="end" (click)="submitComment(post)" [disabled]="sendingComment()">
                    Enviar
                  </ion-button>
                </ion-item>
              </div>
            </article>
          </ion-list>

          <ion-infinite-scroll
            *ngIf="social.posts().length > 0"
            threshold="200px"
            [disabled]="!social.hasMore() || social.loadingMore()"
            (ionInfinite)="onInfinite($event)">
            <ion-infinite-scroll-content loadingSpinner="crescent" loadingText="Cargando más posts…">
            </ion-infinite-scroll-content>
          </ion-infinite-scroll>
        </section>
      </div>
    </ion-content>
  `
})
export class FeedPage implements AfterViewInit {
  @ViewChildren('postCard', { read: ElementRef })
  private postCards?: QueryList<ElementRef<HTMLElement>>;

  postContent = '';
  commentDraft = '';
  readonly publishing = signal(false);
  readonly openedCommentsFor = signal<string | null>(null);
  readonly commentsList = signal<SocialComment[]>([]);
  readonly loadingComments = signal(false);
  readonly sendingComment = signal(false);

  readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? '');

  private readonly platform = inject(PlatformService);
  private readonly animCtrl = inject(AnimationController);
  private animatedIds = new Set<string>();

  constructor(
    public readonly social: SocialService,
    private readonly auth: AuthService,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController
  ) {
    addIcons({
      heart,
      heartOutline,
      chatbubbleOutline,
      trashOutline,
      refreshOutline
    });
  }

  ngAfterViewInit(): void {
    // Animar cards nuevas cuando entren al DOM.
    this.postCards?.changes.subscribe(() => this.animateNewCards());
    queueMicrotask(() => this.animateNewCards());
  }

  private animateNewCards(): void {
    const cards = this.postCards?.toArray() ?? [];
    const posts = this.social.posts();
    cards.forEach((ref, i) => {
      const post = posts[i];
      if (!post || this.animatedIds.has(post.id)) return;
      this.animatedIds.add(post.id);
      void fadeInUp(this.animCtrl, ref.nativeElement, i * 30).play();
    });
  }

  trackById(_: number, p: SocialPost): string {
    return p.id;
  }

  refresh(): void {
    this.animatedIds.clear();
    void this.social.refreshFeed();
  }

  async publishPost(): Promise<void> {
    if (!this.postContent.trim()) return;
    this.publishing.set(true);
    try {
      await this.social.createPost(this.postContent);
      this.postContent = '';
      void this.platform.send();
    } catch (e) {
      void this.platform.error();
      void this.toast(e instanceof Error ? e.message : 'No se pudo publicar.', 'danger');
    } finally {
      this.publishing.set(false);
    }
  }

  async toggleLike(post: SocialPost): Promise<void> {
    void this.platform.tap();
    try {
      await this.social.toggleLike(post.id);
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'No se pudo dar like.', 'danger');
    }
  }

  async deletePost(post: SocialPost): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Borrar post',
      message: '¿Seguro que quieres borrar este post?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Borrar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.social.deletePost(post.id);
              void this.platform.success();
            } catch (e) {
              void this.toast(e instanceof Error ? e.message : 'Error', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async toggleComments(post: SocialPost): Promise<void> {
    if (this.openedCommentsFor() === post.id) {
      this.openedCommentsFor.set(null);
      this.commentsList.set([]);
      return;
    }
    this.openedCommentsFor.set(post.id);
    this.loadingComments.set(true);
    try {
      this.commentsList.set(await this.social.getComments(post.id));
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'No se pudieron cargar los comentarios.', 'danger');
    } finally {
      this.loadingComments.set(false);
    }
  }

  async submitComment(post: SocialPost): Promise<void> {
    if (!this.commentDraft.trim()) return;
    this.sendingComment.set(true);
    try {
      const c = await this.social.addComment(post.id, this.commentDraft);
      this.commentsList.update((items) => [...items, c]);
      this.commentDraft = '';
      void this.platform.tap();
    } catch (e) {
      void this.toast(e instanceof Error ? e.message : 'Error', 'danger');
    } finally {
      this.sendingComment.set(false);
    }
  }

  async onInfinite(ev: InfiniteScrollCustomEvent): Promise<void> {
    try {
      await this.social.loadMoreFeed();
    } finally {
      await ev.target.complete();
    }
  }

  private async toast(message: string, color: 'success' | 'danger' = 'success'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2200, color, position: 'top' });
    await t.present();
  }
}

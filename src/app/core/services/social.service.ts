import { Injectable, computed, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

import { ReviewItem, ReviewStats, SocialComment, SocialPost, UserReviewStats } from '../../models';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { OfflineQueueService, OutboxAction } from './offline-queue.service';
import { SupabaseService } from './supabase.service';

const FEED_PAGE_SIZE = 20;

// ---------- Filas Supabase ----------
interface ReviewRow {
  id: string;
  user_id: string;
  rawg_id: number | null;
  game: string;
  title: string;
  subtitle: string;
  comment: string;
  rating: number;
  author: string;
  created_at: string;
}

interface SocialFeedRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string | null;
  author_avatar: string | null;
  likes_count: number;
  comments_count: number;
  viewer_liked?: boolean;
}

interface ReviewStatsRow {
  total_count: number;
  avg_rating: number;
  rating_1: number; rating_2: number; rating_3: number; rating_4: number; rating_5: number;
  rating_6: number; rating_7: number; rating_8: number; rating_9: number; rating_10: number;
}

interface UserReviewStatsRow {
  total_count: number;
  avg_rating: number;
  last_review_at: string | null;
}

interface SocialPostRow {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface SocialCommentRow {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

interface ProfileSummaryRow {
  id: string;
  name: string | null;
  avatar: string | null;
}

export interface CreateReviewPayload {
  userId: string;
  gameId: number | null;
  game: string;
  title: string;
  subtitle: string;
  comment: string;
  rating: number;
  author: string;
}

@Injectable({ providedIn: 'root' })
export class SocialService {
  readonly reviews = signal<ReviewItem[]>([]);
  readonly posts = signal<SocialPost[]>([]);
  readonly loadingPosts = signal(false);
  readonly loadingMore = signal(false);
  readonly hasMore = signal(true);

  /** Timestamp ISO del post mas antiguo cargado (cursor para paginar). */
  readonly oldestCursor = computed(() => {
    const arr = this.posts();
    return arr.length ? arr[arr.length - 1].createdAtTimestamp : null;
  });

  private postsChannel: RealtimeChannel | null = null;
  private likesChannel: RealtimeChannel | null = null;
  private commentsChannel: RealtimeChannel | null = null;
  private reviewsChannel: RealtimeChannel | null = null;
  private initialized = false;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auth: AuthService,
    private readonly network: NetworkService,
    private readonly offlineQueue: OfflineQueueService
  ) {
    this.offlineQueue.register('create_post', (action) => this.executeCreatePost(action));
    this.offlineQueue.register('toggle_like', (action) => this.executeToggleLike(action));
    if (this.supabaseService.isConfigured) {
      void this.bootstrap();
    }
  }

  // -------------------------------------------------------------------
  // BOOTSTRAP / REALTIME
  // -------------------------------------------------------------------
  private async bootstrap(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    await this.auth.waitUntilReady();
    await Promise.all([
      this.loadReviews().catch((e) => console.error('reviews:', e)),
      this.loadFeed().catch((e) => console.error('feed:', e))
    ]);
    this.subscribeRealtime();
  }

  private subscribeRealtime(): void {
    const client = this.supabaseService.client;
    if (!client) return;

    this.postsChannel?.unsubscribe();
    this.likesChannel?.unsubscribe();
    this.commentsChannel?.unsubscribe();
    this.reviewsChannel?.unsubscribe();

    // Posts: refresca top del feed solo para INSERT (mas eficiente).
    this.postsChannel = client
      .channel('social_posts_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_posts' },
        () => { void this.refreshFeed(); }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'social_posts' },
        (payload) => {
          const removed = (payload.old as { id?: string } | null)?.id;
          if (removed) {
            this.posts.update((items) => items.filter((p) => p.id !== removed));
          }
        }
      )
      .subscribe();

    // Likes: aplica delta sobre el post afectado, sin recargar todo.
    const me = () => this.auth.currentUser()?.id ?? null;
    this.likesChannel = client
      .channel('social_post_likes_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_post_likes' },
        (payload) => {
          const row = payload.new as { post_id: string; user_id: string };
          this.applyLikeDelta(row.post_id, +1, row.user_id === me());
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'social_post_likes' },
        (payload) => {
          const row = payload.old as { post_id: string; user_id: string };
          this.applyLikeDelta(row.post_id, -1, row.user_id === me() ? false : null);
        }
      )
      .subscribe();

    // Comentarios: solo contador.
    this.commentsChannel = client
      .channel('social_post_comments_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_post_comments' },
        (payload) => {
          const postId = (payload.new as { post_id?: string } | null)?.post_id;
          if (postId) this.applyCommentDelta(postId, +1);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'social_post_comments' },
        (payload) => {
          const postId = (payload.old as { post_id?: string } | null)?.post_id;
          if (postId) this.applyCommentDelta(postId, -1);
        }
      )
      .subscribe();

    this.reviewsChannel = client
      .channel('game_reviews_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_reviews' },
        (payload) => {
          const row = payload.new as ReviewRow;
          const mapped = this.mapReviewRow(row);
          this.reviews.update((items) => {
            const without = items.filter((r) => r.id !== mapped.id);
            return [mapped, ...without];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_reviews' },
        (payload) => {
          const row = payload.new as ReviewRow;
          const mapped = this.mapReviewRow(row);
          this.reviews.update((items) =>
            items.map((r) => (r.id === mapped.id ? mapped : r))
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'game_reviews' },
        (payload) => {
          const removed = (payload.old as { id?: string } | null)?.id;
          if (removed) {
            this.reviews.update((items) => items.filter((r) => r.id !== removed));
          }
        }
      )
      .subscribe();
  }

  private applyLikeDelta(postId: string, delta: number, viewerLiked: boolean | null): void {
    this.posts.update((items) =>
      items.map((p) => {
        if (p.id !== postId) return p;
        const next: SocialPost = {
          ...p,
          likes: Math.max(0, p.likes + delta)
        };
        if (viewerLiked !== null) next.liked = viewerLiked;
        return next;
      })
    );
  }

  private applyCommentDelta(postId: string, delta: number): void {
    this.posts.update((items) =>
      items.map((p) => (p.id === postId ? { ...p, comments: Math.max(0, p.comments + delta) } : p))
    );
  }

  // -------------------------------------------------------------------
  // REVIEWS
  // -------------------------------------------------------------------
  async loadReviews(): Promise<void> {
    const client = this.supabaseService.client;
    if (!client) return;

    const { data, error } = await client
      .from('game_reviews')
      .select('id, user_id, rawg_id, game, title, subtitle, comment, rating, author, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(this.mapError(error.message, 'game_reviews'));

    this.reviews.set((data as ReviewRow[] | null)?.map((row) => this.mapReviewRow(row)) ?? []);
  }

  async addReview(payload: CreateReviewPayload): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const normalized = this.normalizeReviewPayload(payload);

    const { data, error } = await client
      .from('game_reviews')
      .insert({
        user_id: normalized.userId,
        rawg_id: normalized.gameId,
        game: normalized.game,
        title: normalized.title,
        subtitle: normalized.subtitle,
        comment: normalized.comment,
        rating: normalized.rating,
        author: normalized.author
      })
      .select('id, user_id, rawg_id, game, title, subtitle, comment, rating, author, created_at')
      .single<ReviewRow>();

    if (error) throw new Error(this.mapError(error.message, 'game_reviews'));

    this.reviews.update((items) => [this.mapReviewRow(data), ...items]);
  }

  async deleteReview(reviewId: string): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { error } = await client.from('game_reviews').delete().eq('id', reviewId);
    if (error) throw new Error(this.mapError(error.message, 'game_reviews'));
    this.reviews.update((items) => items.filter((review) => review.id !== reviewId));
  }

  getReviewsForGame(gameId: number, gameName?: string): ReviewItem[] {
    const normalizedName = gameName?.trim().toLowerCase();
    return this.reviews().filter(
      (review) =>
        review.gameId === gameId ||
        (normalizedName ? review.game.trim().toLowerCase() === normalizedName : false)
    );
  }

  async getReviewsForUser(userId: string): Promise<ReviewItem[]> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('game_reviews')
      .select('id, user_id, rawg_id, game, title, subtitle, comment, rating, author, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(this.mapError(error.message, 'game_reviews'));
    return ((data as ReviewRow[] | null) ?? []).map((row) => this.mapReviewRow(row));
  }

  async getReviewById(reviewId: string): Promise<ReviewItem> {
    const cached = this.reviews().find((review) => review.id === reviewId);
    if (cached) {
      return cached;
    }

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('game_reviews')
      .select('id, user_id, rawg_id, game, title, subtitle, comment, rating, author, created_at')
      .eq('id', reviewId)
      .single<ReviewRow>();

    if (error) throw new Error(this.mapError(error.message, 'game_reviews'));
    return this.mapReviewRow(data);
  }

  // -------------------------------------------------------------------
  // POSTS / FEED
  // -------------------------------------------------------------------

  /**
   * Carga la primera pagina del feed personalizado (posts del usuario
   * + los de gente que sigue) via RPC `get_user_feed`. Resetea cursor.
   */
  async loadFeed(): Promise<void> {
    const client = this.supabaseService.client;
    if (!client) return;

    this.loadingPosts.set(true);
    try {
      const { data, error } = await client.rpc('get_user_feed', {
        before_ts: null,
        page_limit: FEED_PAGE_SIZE
      });
      if (error) throw new Error(this.mapError(error.message, 'social_posts'));
      const rows = (data as SocialFeedRow[] | null) ?? [];
      this.posts.set(rows.map((r) => this.mapFeedRow(r, r.viewer_liked ?? false)));
      this.hasMore.set(rows.length === FEED_PAGE_SIZE);
    } finally {
      this.loadingPosts.set(false);
    }
  }

  /** Alias retrocompatible. */
  async loadPosts(): Promise<void> {
    return this.loadFeed();
  }

  /** Refresca solo los posts mas recientes (no resetea los ya cargados). */
  async refreshFeed(): Promise<void> {
    const client = this.supabaseService.client;
    if (!client) return;
    const { data, error } = await client.rpc('get_user_feed', {
      before_ts: null,
      page_limit: FEED_PAGE_SIZE
    });
    if (error) return; // silencioso: es un refresh oportunista
    const rows = (data as SocialFeedRow[] | null) ?? [];
    const existingIds = new Set(this.posts().map((p) => p.id));
    const fresh = rows
      .filter((r) => !existingIds.has(r.id))
      .map((r) => this.mapFeedRow(r, r.viewer_liked ?? false));
    if (fresh.length) {
      this.posts.update((items) => [...fresh, ...items]);
    }
  }

  /** Carga la siguiente pagina usando el cursor del ultimo post visible. */
  async loadMoreFeed(): Promise<void> {
    if (this.loadingMore() || !this.hasMore()) return;
    const client = this.supabaseService.client;
    if (!client) return;
    const cursorTs = this.oldestCursor();
    if (cursorTs === null) return;

    this.loadingMore.set(true);
    try {
      const { data, error } = await client.rpc('get_user_feed', {
        before_ts: new Date(cursorTs).toISOString(),
        page_limit: FEED_PAGE_SIZE
      });
      if (error) throw new Error(this.mapError(error.message, 'social_posts'));
      const rows = (data as SocialFeedRow[] | null) ?? [];
      const mapped = rows.map((r) => this.mapFeedRow(r, r.viewer_liked ?? false));
      this.posts.update((items) => [...items, ...mapped]);
      this.hasMore.set(rows.length === FEED_PAGE_SIZE);
    } finally {
      this.loadingMore.set(false);
    }
  }

  async getPostsByUser(userId: string): Promise<SocialPost[]> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('social_feed')
      .select('id, user_id, content, created_at, author_name, author_avatar, likes_count, comments_count')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(this.mapError(error.message, 'social_posts'));
    return ((data as SocialFeedRow[] | null) ?? []).map((row) => this.mapFeedRow(row, false));
  }

  async createPost(content: string): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) throw new Error('Necesitas sesion para publicar.');
    const clean = content.trim();
    if (!clean) return;

    // Offline: encolar y mostrar post pendiente.
    if (!this.network.online()) {
      const tempId = `pending-${crypto.randomUUID()}`;
      const nowIso = new Date().toISOString();
      const optimistic: SocialPost = {
        id: tempId,
        userId: me.id,
        author: me.name,
        authorAvatar: me.avatar || this.initials(me.name),
        content: clean,
        likes: 0,
        comments: 0,
        liked: false,
        createdAt: this.formatDate(nowIso),
        createdAtTimestamp: Date.now(),
        pending: true
      };
      this.posts.update((items) => [optimistic, ...items]);
      await this.offlineQueue.enqueue({
        id: tempId,
        type: 'create_post',
        payload: { content: clean, tempId }
      });
      return;
    }

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('social_posts')
      .insert({ user_id: me.id, content: clean })
      .select('id, user_id, content, created_at')
      .single<SocialPostRow>();

    if (error) throw new Error(this.mapError(error.message, 'social_posts'));

    const optimistic: SocialPost = {
      id: data.id,
      userId: data.user_id,
      author: me.name,
      authorAvatar: me.avatar || this.initials(me.name),
      content: data.content,
      likes: 0,
      comments: 0,
      liked: false,
      createdAt: this.formatDate(data.created_at),
      createdAtTimestamp: new Date(data.created_at).getTime()
    };
    this.posts.update((items) => [optimistic, ...items.filter((p) => p.id !== optimistic.id)]);
  }

  private async executeCreatePost(action: OutboxAction): Promise<void> {
    const content = action.payload['content'] as string;
    const tempId = action.payload['tempId'] as string;
    const me = this.auth.currentUser();
    if (!me) throw new Error('No hay sesion activa.');

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('social_posts')
      .insert({ user_id: me.id, content })
      .select('id, user_id, content, created_at')
      .single<SocialPostRow>();
    if (error) throw new Error(error.message);

    const real: SocialPost = {
      id: data.id,
      userId: data.user_id,
      author: me.name,
      authorAvatar: me.avatar || this.initials(me.name),
      content: data.content,
      likes: 0,
      comments: 0,
      liked: false,
      createdAt: this.formatDate(data.created_at),
      createdAtTimestamp: new Date(data.created_at).getTime()
    };
    // Sustituir el placeholder por el post real.
    this.posts.update((items) => {
      const without = items.filter((p) => p.id !== tempId && p.id !== real.id);
      return [real, ...without];
    });
  }

  async deletePost(postId: string): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { error } = await client.from('social_posts').delete().eq('id', postId);
    if (error) throw new Error(this.mapError(error.message, 'social_posts'));
    this.posts.update((items) => items.filter((p) => p.id !== postId));
  }

  async toggleLike(postId: string): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) return;

    const current = this.posts().find((p) => p.id === postId);
    const prevLiked = current?.liked ?? false;
    const prevCount = current?.likes ?? 0;

    // UI optimista (aplicar siempre)
    this.posts.update((items) =>
      items.map((p) =>
        p.id === postId
          ? { ...p, liked: !prevLiked, likes: Math.max(0, prevCount + (prevLiked ? -1 : 1)) }
          : p
      )
    );

    // Offline: encolar y dejar que el flush reconcilie cuando vuelva online.
    if (!this.network.online()) {
      // Posts pendientes (tempId) aún no existen en servidor: no encolar like.
      if (postId.startsWith('pending-')) return;
      await this.offlineQueue.enqueue({
        id: `${postId}:${Date.now()}`,
        type: 'toggle_like',
        payload: { postId }
      });
      return;
    }

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc('toggle_post_like', { p_post: postId });
    if (error) {
      // Rollback
      this.posts.update((items) =>
        items.map((p) =>
          p.id === postId ? { ...p, liked: prevLiked, likes: prevCount } : p
        )
      );
      throw new Error(this.mapError(error.message, 'social_post_likes'));
    }

    // Reconcilia con el valor autoritativo del servidor
    const row = ((data as { liked: boolean; likes_count: number }[] | null) ?? [])[0];
    if (row) {
      this.posts.update((items) =>
        items.map((p) =>
          p.id === postId ? { ...p, liked: row.liked, likes: row.likes_count } : p
        )
      );
    }
  }

  private async executeToggleLike(action: OutboxAction): Promise<void> {
    const postId = action.payload['postId'] as string;
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc('toggle_post_like', { p_post: postId });
    if (error) throw new Error(error.message);

    const row = ((data as { liked: boolean; likes_count: number }[] | null) ?? [])[0];
    if (row) {
      this.posts.update((items) =>
        items.map((p) =>
          p.id === postId ? { ...p, liked: row.liked, likes: row.likes_count } : p
        )
      );
    }
  }

  hasLikedPost(postId: string): boolean {
    return this.posts().find((p) => p.id === postId)?.liked ?? false;
  }

  // -------------------------------------------------------------------
  // REVIEW STATS
  // -------------------------------------------------------------------
  async getReviewStats(rawgId: number): Promise<ReviewStats> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc('get_review_stats', { p_rawg_id: rawgId });
    if (error) throw new Error(this.mapError(error.message, 'game_reviews'));
    const row = ((data as ReviewStatsRow[] | null) ?? [])[0];
    if (!row) {
      return { totalCount: 0, avgRating: 0, distribution: new Array(10).fill(0) };
    }
    return {
      totalCount: row.total_count ?? 0,
      avgRating: Number(row.avg_rating ?? 0),
      distribution: [
        row.rating_1, row.rating_2, row.rating_3, row.rating_4, row.rating_5,
        row.rating_6, row.rating_7, row.rating_8, row.rating_9, row.rating_10
      ].map((n) => Number(n ?? 0))
    };
  }

  async getUserReviewStats(userId: string): Promise<UserReviewStats> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc('get_user_review_stats', { p_user: userId });
    if (error) throw new Error(this.mapError(error.message, 'game_reviews'));
    const row = ((data as UserReviewStatsRow[] | null) ?? [])[0];
    return {
      totalCount: row?.total_count ?? 0,
      avgRating: Number(row?.avg_rating ?? 0),
      lastReviewAt: row?.last_review_at ?? null
    };
  }

  // -------------------------------------------------------------------
  // COMENTARIOS
  // -------------------------------------------------------------------
  async getComments(postId: string): Promise<SocialComment[]> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('social_post_comments')
      .select('id, post_id, user_id, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(this.mapError(error.message, 'social_post_comments'));

    const comments = (data as SocialCommentRow[] | null) ?? [];
    const profilesById = await this.loadProfilesById(comments.map((row) => row.user_id));

    return comments.map((row) => {
      const prof = profilesById.get(row.user_id);
      const author = prof?.name ?? 'Usuario';

      return {
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        author,
        authorAvatar: prof?.avatar || this.initials(author),
        content: row.content,
        createdAt: this.formatDate(row.created_at)
      };
    });
  }

  async addComment(postId: string, content: string): Promise<SocialComment> {
    const me = this.auth.currentUser();
    if (!me) throw new Error('Necesitas sesion para comentar.');
    const clean = content.trim();
    if (!clean) throw new Error('Escribe un comentario.');

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('social_post_comments')
      .insert({ post_id: postId, user_id: me.id, content: clean })
      .select('id, post_id, user_id, content, created_at')
      .single<SocialCommentRow>();

    if (error) throw new Error(this.mapError(error.message, 'social_post_comments'));

    this.posts.update((items) =>
      items.map((p) => (p.id === postId ? { ...p, comments: p.comments + 1 } : p))
    );

    return {
      id: data.id,
      postId: data.post_id,
      userId: data.user_id,
      author: me.name,
      authorAvatar: me.avatar || this.initials(me.name),
      content: data.content,
      createdAt: this.formatDate(data.created_at)
    };
  }

  // -------------------------------------------------------------------
  // HELPERS
  // -------------------------------------------------------------------
  private mapReviewRow(row: ReviewRow): ReviewItem {
    const createdAtTimestamp = new Date(row.created_at).getTime();
    return {
      id: row.id,
      gameId: row.rawg_id,
      game: row.game,
      title: row.title,
      subtitle: row.subtitle,
      rating: row.rating,
      comment: row.comment,
      author: row.author,
      createdAt: this.formatDate(row.created_at),
      createdAtTimestamp: Number.isFinite(createdAtTimestamp) ? createdAtTimestamp : Date.now()
    };
  }

  private mapFeedRow(row: SocialFeedRow, liked: boolean): SocialPost {
    const ts = new Date(row.created_at).getTime();
    const author = row.author_name ?? 'Usuario';
    return {
      id: row.id,
      userId: row.user_id,
      author,
      authorAvatar: row.author_avatar || this.initials(author),
      content: row.content,
      likes: row.likes_count ?? 0,
      comments: row.comments_count ?? 0,
      liked,
      createdAt: this.formatDate(row.created_at),
      createdAtTimestamp: Number.isFinite(ts) ? ts : Date.now()
    };
  }

  private normalizeReviewPayload(p: CreateReviewPayload): CreateReviewPayload {
    return {
      userId: p.userId,
      gameId: p.gameId,
      game: p.game.trim(),
      title: p.title.trim(),
      subtitle: p.subtitle.trim(),
      comment: p.comment.trim(),
      rating: p.rating,
      author: p.author.trim()
    };
  }

  private async loadProfilesById(userIds: string[]): Promise<Map<string, ProfileSummaryRow>> {
    const uniqueIds = [...new Set(userIds.filter(Boolean))];
    const profilesById = new Map<string, ProfileSummaryRow>();

    if (!uniqueIds.length) {
      return profilesById;
    }

    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('profiles')
      .select('id, name, avatar')
      .in('id', uniqueIds);

    if (error) {
      throw new Error(this.mapError(error.message, 'profiles'));
    }

    for (const profile of (data as ProfileSummaryRow[] | null) ?? []) {
      profilesById.set(profile.id, profile);
    }

    return profilesById;
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Ahora';
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((it) => it[0]?.toUpperCase() ?? '')
      .join('');
  }

  private mapError(message: string, table: string): string {
    const normalized = message.toLowerCase();
    if (normalized.includes(table)) {
      return `La tabla public.${table} no existe o no es accesible. Ejecuta los scripts en supabase/.`;
    }
    if (normalized.includes('row-level security')) {
      return `La politica RLS de public.${table} no permite esta operacion.`;
    }
    return message;
  }
}

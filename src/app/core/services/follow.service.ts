import { Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';

import { FollowStats, ProfileSummary } from '../../models';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

interface FollowCountsRow {
  followers_count: number;
  following_count: number;
}

interface FollowListRow {
  id: string;
  name: string | null;
  avatar: string | null;
  bio: string | null;
  followed_at: string;
  viewer_follows: boolean;
}

@Injectable({ providedIn: 'root' })
export class FollowService {
  /** Cache local: a quien sigo (mis followed_id). */
  readonly followingIds = signal<Set<string>>(new Set());
  private bootstrapped = false;
  private channel: RealtimeChannel | null = null;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly auth: AuthService
  ) {
    if (this.supabaseService.isConfigured) {
      void this.bootstrap();
    }
  }

  private async bootstrap(): Promise<void> {
    if (this.bootstrapped) return;
    this.bootstrapped = true;
    await this.auth.waitUntilReady();
    if (!this.auth.currentUser()) return;
    await this.refreshFollowing().catch((e) => console.error('follows:', e));
    this.subscribeRealtime();
  }

  private subscribeRealtime(): void {
    const client = this.supabaseService.client;
    const me = this.auth.currentUser();
    if (!client || !me) return;

    this.channel?.unsubscribe();
    this.channel = client
      .channel('follows_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows', filter: `follower_id=eq.${me.id}` },
        (payload) => {
          const target = (payload.new as { followed_id?: string } | null)?.followed_id;
          if (target) {
            this.followingIds.update((s) => new Set(s).add(target));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'follows', filter: `follower_id=eq.${me.id}` },
        (payload) => {
          const target = (payload.old as { followed_id?: string } | null)?.followed_id;
          if (target) {
            this.followingIds.update((s) => {
              const next = new Set(s);
              next.delete(target);
              return next;
            });
          }
        }
      )
      .subscribe();
  }

  async refreshFollowing(): Promise<void> {
    const me = this.auth.currentUser();
    const client = this.supabaseService.client;
    if (!me || !client) return;

    const { data, error } = await client
      .from('follows')
      .select('followed_id')
      .eq('follower_id', me.id);

    if (error) throw new Error(this.mapError(error.message));

    this.followingIds.set(
      new Set(((data as { followed_id: string }[] | null) ?? []).map((r) => r.followed_id))
    );
  }

  isFollowing(userId: string): boolean {
    return this.followingIds().has(userId);
  }

  async follow(userId: string): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) throw new Error('No hay sesion activa.');
    if (userId === me.id) return;

    const client = this.supabaseService.assertConfigured();
    const { error } = await client
      .from('follows')
      .upsert(
        { follower_id: me.id, followed_id: userId },
        { onConflict: 'follower_id,followed_id' }
      );

    if (error) throw new Error(this.mapError(error.message));
    this.followingIds.update((set) => new Set(set).add(userId));
  }

  async unfollow(userId: string): Promise<void> {
    const me = this.auth.currentUser();
    if (!me) throw new Error('No hay sesion activa.');

    const client = this.supabaseService.assertConfigured();
    const { error } = await client
      .from('follows')
      .delete()
      .eq('follower_id', me.id)
      .eq('followed_id', userId);

    if (error) throw new Error(this.mapError(error.message));
    this.followingIds.update((set) => {
      const next = new Set(set);
      next.delete(userId);
      return next;
    });
  }

  /**
   * Estadisticas de follows usando RPCs (`get_follow_counts` +
   * `is_following`). Mucho mas eficiente que 3 head-counts.
   */
  async getStats(userId: string): Promise<FollowStats> {
    const client = this.supabaseService.assertConfigured();
    const me = this.auth.currentUser();

    const [countsRes, isFollowingRes] = await Promise.all([
      client.rpc('get_follow_counts', { target: userId }),
      me && me.id !== userId
        ? client.rpc('is_following', { target: userId })
        : Promise.resolve({ data: false, error: null } as { data: boolean; error: null })
    ]);

    if (countsRes.error) throw new Error(this.mapError(countsRes.error.message));
    if (isFollowingRes.error) throw new Error(this.mapError(isFollowingRes.error.message));

    const row = ((countsRes.data as FollowCountsRow[] | null) ?? [])[0];
    return {
      followers: row?.followers_count ?? 0,
      following: row?.following_count ?? 0,
      isFollowing: Boolean(isFollowingRes.data)
    };
  }

  async listFollowers(userId: string, limit = 20, offset = 0): Promise<ProfileSummary[]> {
    return this.callList('list_followers', userId, limit, offset);
  }

  async listFollowing(userId: string, limit = 20, offset = 0): Promise<ProfileSummary[]> {
    return this.callList('list_following', userId, limit, offset);
  }

  private async callList(
    rpc: 'list_followers' | 'list_following',
    userId: string,
    limit: number,
    offset: number
  ): Promise<ProfileSummary[]> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.rpc(rpc, {
      target: userId,
      page_limit: limit,
      page_offset: offset
    });
    if (error) throw new Error(this.mapError(error.message));
    return ((data as FollowListRow[] | null) ?? []).map((r) => ({
      id: r.id,
      name: r.name ?? 'Usuario',
      avatar: r.avatar ?? '',
      bio: r.bio ?? '',
      followedAt: r.followed_at,
      viewerFollows: r.viewer_follows
    }));
  }

  private mapError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('follows')) {
      return 'La tabla public.follows no existe. Ejecuta supabase/follows.sql.';
    }
    if (m.includes('row-level security')) {
      return 'La politica RLS de public.follows no permite esta operacion.';
    }
    return message;
  }
}

import { Injectable } from '@angular/core';

import { UserProfile } from '../../models';
import { SupabaseService } from './supabase.service';

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  favorite_game: string;
  bio: string;
  avatar: string;
}

/**
 * Servicio orientado a leer perfiles de OTROS usuarios.
 * El perfil del usuario actual lo gestiona AuthService.
 */
@Injectable({ providedIn: 'root' })
export class ProfileService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async getProfile(userId: string): Promise<UserProfile | null> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('profiles')
      .select('id, email, name, favorite_game, bio, avatar')
      .eq('id', userId)
      .maybeSingle<ProfileRow>();

    if (error) throw new Error(this.mapError(error.message));
    return data ? this.mapRow(data) : null;
  }

  async listAll(): Promise<UserProfile[]> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('profiles')
      .select('id, email, name, favorite_game, bio, avatar')
      .order('name', { ascending: true });

    if (error) throw new Error(this.mapError(error.message));
    return ((data as ProfileRow[] | null) ?? []).map((r) => this.mapRow(r));
  }

  async search(query: string, limit = 30): Promise<UserProfile[]> {
    const client = this.supabaseService.assertConfigured();
    const clean = query.trim();

    // Si hay texto: usar RPC `search_profiles` (trigram, ranking por
    // similitud, excluye al propio usuario). Si no, listar todos.
    if (clean) {
      const { data, error } = await client.rpc('search_profiles', {
        q: clean,
        max_results: Math.min(Math.max(limit, 1), 50)
      });
      if (error) throw new Error(this.mapError(error.message));
      // search_profiles devuelve sin email/favorite_game -> los rellenamos vacios.
      return ((data as Array<{ id: string; name: string; avatar: string; bio: string }> | null) ?? [])
        .map((r) => ({
          id: r.id,
          email: '',
          name: r.name,
          favoriteGame: '',
          bio: r.bio ?? '',
          avatar: r.avatar || this.initials(r.name)
        }));
    }

    const { data, error } = await client
      .from('profiles')
      .select('id, email, name, favorite_game, bio, avatar')
      .order('name', { ascending: true })
      .limit(limit);

    if (error) throw new Error(this.mapError(error.message));
    return ((data as ProfileRow[] | null) ?? []).map((r) => this.mapRow(r));
  }

  private mapRow(row: ProfileRow): UserProfile {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      favoriteGame: row.favorite_game,
      bio: row.bio,
      avatar: row.avatar || this.initials(row.name)
    };
  }

  private initials(name: string): string {
    return (name || '')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((it) => it[0]?.toUpperCase() ?? '')
      .join('');
  }

  private mapError(message: string): string {
    const m = message.toLowerCase();
    if (m.includes('profiles')) {
      return 'La tabla public.profiles no existe o no es accesible. Ejecuta supabase/profiles.sql.';
    }
    if (m.includes('row-level security')) {
      return 'La politica RLS de public.profiles no permite esta operacion.';
    }
    return message;
  }
}

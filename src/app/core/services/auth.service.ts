import { Injectable, computed, signal } from '@angular/core';
import { AuthError, Session, User } from '@supabase/supabase-js';

import { UserProfile } from '../../models';
import { SupabaseService } from './supabase.service';

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  favoriteGame: string;
  bio: string;
}

interface RegisterResult {
  requiresEmailConfirmation: boolean;
}

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  favorite_game: string;
  bio: string;
  avatar: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly currentUserState = signal<UserProfile | null>(null);
  private readonly readyState = signal(false);
  private readonly readyPromise: Promise<void>;

  readonly currentUser = computed(() => this.currentUserState());
  readonly isAuthenticated = computed(() => Boolean(this.currentUserState()));
  readonly isReady = computed(() => this.readyState());

  constructor(private readonly supabaseService: SupabaseService) {
    this.readyPromise = this.initialize();
  }

  async waitUntilReady(): Promise<void> {
    await this.readyPromise;
  }

  async login(email: string, password: string): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      throw new Error(this.mapAuthError(error));
    }

    await this.refreshCurrentUser();
  }

  async register(payload: RegisterPayload): Promise<RegisterResult> {
    const client = this.supabaseService.assertConfigured();
    const cleanPayload = this.normalizeRegisterPayload(payload);
    const avatar = this.initials(cleanPayload.name);
    const emailRedirectTo = this.getEmailRedirectUrl();

    const { data, error } = await client.auth.signUp({
      email: cleanPayload.email,
      password: cleanPayload.password,
      options: {
        emailRedirectTo,
        data: {
          name: cleanPayload.name,
          favoriteGame: cleanPayload.favoriteGame,
          bio: cleanPayload.bio,
          avatar
        }
      }
    });

    if (error) {
      throw new Error(this.mapAuthError(error));
    }

    if (data.user && data.session) {
      await this.upsertProfile(data.user.id, {
        name: cleanPayload.name,
        email: data.user.email ?? cleanPayload.email,
        favoriteGame: cleanPayload.favoriteGame,
        bio: cleanPayload.bio,
        avatar
      });
    }

    return {
      requiresEmailConfirmation: !data.session
    };
  }

  async updateProfile(patch: Partial<UserProfile>): Promise<void> {
    const currentUser = this.currentUserState();
    if (!currentUser) {
      throw new Error('No hay una sesion activa.');
    }

    const nextProfile = this.normalizeProfile({
      ...currentUser,
      ...patch,
      id: currentUser.id,
      email: currentUser.email
    });

    const savedProfile = await this.upsertProfile(currentUser.id, nextProfile);
    this.currentUserState.set(savedProfile);

    const client = this.supabaseService.client;
    if (!client) {
      return;
    }

    const { error } = await client.auth.updateUser({
      data: {
        name: savedProfile.name,
        favoriteGame: savedProfile.favoriteGame,
        bio: savedProfile.bio,
        avatar: savedProfile.avatar
      }
    });

    if (error) {
      throw new Error(this.mapAuthError(error));
    }
  }

  async logout(): Promise<void> {
    const client = this.supabaseService.client;
    if (client) {
      const { error } = await client.auth.signOut();
      if (error) {
        throw new Error(this.mapAuthError(error));
      }
    }

    this.currentUserState.set(null);
  }

  private async initialize(): Promise<void> {
    const client = this.supabaseService.client;

    if (!client) {
      this.readyState.set(true);
      return;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        throw new Error(this.mapAuthError(error));
      }

      await this.syncSession(data.session);

      client.auth.onAuthStateChange((_event, session) => {
        void this.syncSession(session).catch((sessionError) => {
          console.error('No se pudo sincronizar la sesion con Supabase.', sessionError);
        });
      });
    } catch (error) {
      console.error('No se pudo inicializar la autenticacion de Supabase.', error);
      this.currentUserState.set(null);
    } finally {
      this.readyState.set(true);
    }
  }

  private async refreshCurrentUser(): Promise<void> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client.auth.getSession();

    if (error) {
      throw new Error(this.mapAuthError(error));
    }

    await this.syncSession(data.session);
  }

  private async syncSession(session: Session | null): Promise<void> {
    if (!session) {
      this.currentUserState.set(null);
      return;
    }

    const profile = await this.getOrCreateProfile(session.user);
    this.currentUserState.set(profile);
  }

  private async getOrCreateProfile(user: User): Promise<UserProfile> {
    const client = this.supabaseService.assertConfigured();
    const { data, error } = await client
      .from('profiles')
      .select('id, email, name, favorite_game, bio, avatar')
      .eq('id', user.id)
      .maybeSingle<ProfileRow>();

    if (error) {
      throw new Error(this.mapProfileError(error.message));
    }

    if (data) {
      return this.mapProfileRow(data);
    }

    return this.upsertProfile(user.id, this.buildProfileFromUser(user));
  }

  private async upsertProfile(
    userId: string,
    profile: Omit<UserProfile, 'id'> | UserProfile
  ): Promise<UserProfile> {
    const client = this.supabaseService.assertConfigured();
    const normalized = this.normalizeProfile({
      id: userId,
      ...profile,
      email: profile.email
    });

    const { data, error } = await client
      .from('profiles')
      .upsert(
        {
          id: userId,
          email: normalized.email,
          name: normalized.name,
          favorite_game: normalized.favoriteGame,
          bio: normalized.bio,
          avatar: normalized.avatar
        },
        {
          onConflict: 'id'
        }
      )
      .select('id, email, name, favorite_game, bio, avatar')
      .single<ProfileRow>();

    if (error) {
      throw new Error(this.mapProfileError(error.message));
    }

    return this.mapProfileRow(data);
  }

  private buildProfileFromUser(user: User): Omit<UserProfile, 'id'> {
    const name =
      this.readMetadata(user, 'name') ??
      this.readMetadata(user, 'full_name') ??
      user.email?.split('@')[0] ??
      'Jugador';
    const favoriteGame =
      this.readMetadata(user, 'favoriteGame') ?? this.readMetadata(user, 'favorite_game') ?? '';
    const bio = this.readMetadata(user, 'bio') ?? '';
    const avatar = this.readMetadata(user, 'avatar') ?? this.initials(name);

    return {
      name,
      email: user.email ?? '',
      favoriteGame,
      bio,
      avatar
    };
  }

  private normalizeRegisterPayload(payload: RegisterPayload): RegisterPayload {
    return {
      name: payload.name.trim(),
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      favoriteGame: payload.favoriteGame.trim(),
      bio: payload.bio.trim()
    };
  }

  private normalizeProfile(profile: UserProfile): UserProfile {
    const cleanName = profile.name.trim() || 'Jugador';

    return {
      id: profile.id,
      email: profile.email.trim().toLowerCase(),
      name: cleanName,
      favoriteGame: profile.favoriteGame.trim(),
      bio: profile.bio.trim(),
      avatar: profile.avatar.trim() || this.initials(cleanName)
    };
  }

  private mapProfileRow(row: ProfileRow): UserProfile {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      favoriteGame: row.favorite_game,
      bio: row.bio,
      avatar: row.avatar || this.initials(row.name)
    };
  }

  private readMetadata(user: User, key: string): string | null {
    const rawValue = user.user_metadata?.[key];
    return typeof rawValue === 'string' && rawValue.trim() ? rawValue.trim() : null;
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((item) => item[0]?.toUpperCase() ?? '')
      .join('');
  }

  private getEmailRedirectUrl(): string {
    return 'https://gamestat-tfg.vercel.app/landing';
  }

  private mapAuthError(error: AuthError): string {
    const message = error.message.toLowerCase();

    if (message.includes('invalid login credentials')) {
      return 'Email o contrasena incorrectos.';
    }

    if (message.includes('email not confirmed')) {
      return 'Debes confirmar tu email antes de iniciar sesion.';
    }

    if (message.includes('user already registered')) {
      return 'Ya existe una cuenta con ese email.';
    }

    if (message.includes('signup is disabled')) {
      return 'El registro por email esta deshabilitado en Supabase.';
    }

    if (message.includes('rate limit')) {
      return 'Supabase ha limitado temporalmente el envio de emails. Espera unos minutos antes de intentarlo otra vez.';
    }

    return error.message;
  }

  private mapProfileError(message: string): string {
    const normalized = message.toLowerCase();

    if (normalized.includes('relation') && normalized.includes('profiles')) {
      return 'La tabla public.profiles no existe en Supabase. Ejecuta el script supabase/profiles.sql.';
    }

    if (normalized.includes('row-level security')) {
      return 'La politica RLS de public.profiles no permite esta operacion. Revisa el script supabase/profiles.sql.';
    }

    return message;
  }
}

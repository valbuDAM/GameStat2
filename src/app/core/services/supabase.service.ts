import { Injectable } from '@angular/core';
import { SupabaseClient, createClient } from '@supabase/supabase-js';

import { environment } from '../../../environments/environment';

const noOpLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>
): Promise<T> => fn();

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly url = environment.supabase.url.trim();
  readonly anonKey = environment.supabase.anonKey.trim();

  readonly client: SupabaseClient | null =
    this.url && this.anonKey && !this.anonKey.startsWith('REEMPLAZA_')
      ? createClient(this.url, this.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
            lock: noOpLock
          }
        })
      : null;

  get isConfigured(): boolean {
    return this.client !== null;
  }

  assertConfigured(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Falta configurar la clave anon de Supabase en src/environments/environment.ts.'
      );
    }

    return this.client;
  }
}

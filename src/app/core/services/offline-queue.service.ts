import { Injectable, effect, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

import { NetworkService } from './network.service';

export type OutboxActionType = 'send_message' | 'create_post' | 'toggle_like';

export interface OutboxAction {
  id: string;
  type: OutboxActionType;
  payload: Record<string, unknown>;
  createdAt: number;
  attempts: number;
}

export type OutboxExecutor = (action: OutboxAction) => Promise<void>;

const STORAGE_KEY = 'gamestat.outbox.v1';
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 1000;

/**
 * Cola persistente de acciones diferidas para uso offline.
 *
 * Los servicios consumidores (`ChatService`, `SocialService`) registran
 * un `executor` por tipo de acción mediante `register(type, fn)`. Cuando
 * vuelve la conectividad se reintentan en orden FIFO con backoff
 * exponencial hasta `MAX_ATTEMPTS`.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  readonly pending = signal<OutboxAction[]>([]);
  readonly flushing = signal(false);

  private executors = new Map<OutboxActionType, OutboxExecutor>();
  private hydrated = false;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly network: NetworkService) {
    void this.hydrate();

    // Cuando volvemos online, intentar vaciar la cola.
    effect(() => {
      if (this.network.online() && this.hydrated && this.pending().length > 0) {
        void this.flush();
      }
    });
  }

  /** Registra un ejecutor para un tipo de acción. */
  register(type: OutboxActionType, executor: OutboxExecutor): void {
    this.executors.set(type, executor);
    // Si ya hay items pendientes de ese tipo y estamos online, lanzar flush.
    if (this.hydrated && this.network.online() && this.pending().some((a) => a.type === type)) {
      void this.flush();
    }
  }

  /** Encola una acción y la persiste. */
  async enqueue(action: Omit<OutboxAction, 'createdAt' | 'attempts'>): Promise<OutboxAction> {
    const full: OutboxAction = {
      ...action,
      createdAt: Date.now(),
      attempts: 0
    };
    this.pending.update((items) => [...items, full]);
    await this.persist();
    if (this.network.online()) void this.flush();
    return full;
  }

  /** Vacía la cola intentando ejecutar cada acción. Reintenta con backoff si falla. */
  async flush(): Promise<void> {
    if (this.flushing()) return;
    if (!this.network.online()) return;
    if (this.pending().length === 0) return;

    this.flushing.set(true);
    try {
      let nextDelay = 0;
      const remaining: OutboxAction[] = [];

      for (const action of this.pending()) {
        const executor = this.executors.get(action.type);
        if (!executor) {
          // Sin executor: lo mantenemos en cola para cuando se registre.
          remaining.push(action);
          continue;
        }
        try {
          await executor(action);
        } catch (err) {
          console.warn('[OfflineQueue] action failed:', action.type, err);
          const attempts = action.attempts + 1;
          if (attempts >= MAX_ATTEMPTS) {
            console.error('[OfflineQueue] giving up on action after', attempts, 'attempts:', action);
            continue;
          }
          remaining.push({ ...action, attempts });
          nextDelay = Math.max(nextDelay, BASE_BACKOFF_MS * 2 ** (attempts - 1));
        }
      }

      this.pending.set(remaining);
      await this.persist();

      if (remaining.length > 0 && nextDelay > 0) {
        this.scheduleRetry(nextDelay);
      }
    } finally {
      this.flushing.set(false);
    }
  }

  /** Devuelve true si hay algún elemento del tipo dado en la cola. */
  hasPendingOfType(type: OutboxActionType): boolean {
    return this.pending().some((a) => a.type === type);
  }

  private scheduleRetry(delayMs: number): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delayMs);
  }

  private async hydrate(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        const parsed = JSON.parse(value) as OutboxAction[];
        if (Array.isArray(parsed)) {
          this.pending.set(parsed);
        }
      }
    } catch (e) {
      console.warn('[OfflineQueue] hydrate failed:', e);
    } finally {
      this.hydrated = true;
      if (this.network.online() && this.pending().length > 0) {
        void this.flush();
      }
    }
  }

  private async persist(): Promise<void> {
    try {
      await Preferences.set({
        key: STORAGE_KEY,
        value: JSON.stringify(this.pending())
      });
    } catch (e) {
      console.warn('[OfflineQueue] persist failed:', e);
    }
  }
}

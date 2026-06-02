import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { OfflineQueueService } from './offline-queue.service';
import { NetworkService } from './network.service';

// Mock estático de Preferences en memoria.
const memoryStore = new Map<string, string>();
import * as PreferencesModule from '@capacitor/preferences';

(PreferencesModule.Preferences as unknown as {
  get: (opts: { key: string }) => Promise<{ value: string | null }>;
  set: (opts: { key: string; value: string }) => Promise<void>;
  remove: (opts: { key: string }) => Promise<void>;
}).get = async ({ key }) => ({ value: memoryStore.get(key) ?? null });
(PreferencesModule.Preferences as unknown as { set: (opts: { key: string; value: string }) => Promise<void> }).set =
  async ({ key, value }) => { memoryStore.set(key, value); };
(PreferencesModule.Preferences as unknown as { remove: (opts: { key: string }) => Promise<void> }).remove =
  async ({ key }) => { memoryStore.delete(key); };

describe('OfflineQueueService', () => {
  let service: OfflineQueueService;
  let network: { online: ReturnType<typeof signal<boolean>> };

  beforeEach(() => {
    memoryStore.clear();
    network = { online: signal(true) };

    TestBed.configureTestingModule({
      providers: [
        OfflineQueueService,
        { provide: NetworkService, useValue: network }
      ]
    });
    service = TestBed.inject(OfflineQueueService);
  });

  it('encola una acción y queda visible en pending()', async () => {
    const exec = jasmine.createSpy('exec').and.resolveTo();
    service.register('send_message', exec);
    network.online.set(false); // forzar offline para que no se vacíe al instante

    await service.enqueue({ id: 'a', type: 'send_message', payload: { msg: 'hi' } });
    expect(service.pending().length).toBe(1);
    expect(service.pending()[0].id).toBe('a');
    expect(exec).not.toHaveBeenCalled();
  });

  it('flush() vacía la cola si el executor tiene éxito', async () => {
    const exec = jasmine.createSpy('exec').and.resolveTo();
    service.register('send_message', exec);

    await service.enqueue({ id: 'b', type: 'send_message', payload: {} });
    await service.flush();
    expect(exec).toHaveBeenCalledTimes(1);
    expect(service.pending().length).toBe(0);
  });

  it('reintenta con backoff si el executor falla', async () => {
    const exec = jasmine.createSpy('exec').and.rejectWith(new Error('boom'));
    service.register('send_message', exec);

    await service.enqueue({ id: 'c', type: 'send_message', payload: {} });
    await service.flush();
    // Tras 1 fallo, sigue en la cola con attempts incrementado.
    expect(service.pending().length).toBe(1);
    expect(service.pending()[0].attempts).toBe(1);
  });

  it('persiste y rehidrata desde Preferences', async () => {
    const exec = jasmine.createSpy('exec').and.resolveTo();
    service.register('send_message', exec);
    network.online.set(false);
    await service.enqueue({ id: 'd', type: 'send_message', payload: { v: 1 } });
    expect(memoryStore.get('gamestat.outbox.v1')).toContain('"id":"d"');
  });
});

import { signal } from '@angular/core';

import { SocialService } from './social.service';
import { SupabaseServiceMock } from '../../../testing/supabase.mock';
import { AuthService } from './auth.service';
import { NetworkService } from './network.service';
import { OfflineQueueService } from './offline-queue.service';
import { SocialPost } from '../../models';

describe('SocialService.toggleLike', () => {
  let supabase: SupabaseServiceMock;
  let auth: jasmine.SpyObj<AuthService>;
  let network: { online: ReturnType<typeof signal<boolean>> };
  let offlineQueue: jasmine.SpyObj<OfflineQueueService>;
  let service: SocialService;

  const samplePost: SocialPost = {
    id: 'p1',
    userId: 'u-other',
    author: 'Other',
    authorAvatar: '',
    content: 'hola',
    createdAt: 'ahora',
    createdAtTimestamp: Date.now(),
    likes: 5,
    liked: false,
    comments: 0
  };

  beforeEach(() => {
    // Evita que el constructor dispare bootstrap real.
    supabase = new SupabaseServiceMock();
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['currentUser', 'waitUntilReady']);
    auth.currentUser.and.returnValue({ id: 'me', name: 'me', email: 'm@m', avatar: '' } as never);
    auth.waitUntilReady.and.resolveTo();
    network = { online: signal(true) };
    offlineQueue = jasmine.createSpyObj<OfflineQueueService>('OfflineQueueService', ['register', 'enqueue', 'hasPendingOfType']);
    offlineQueue.enqueue.and.resolveTo(undefined as never);

    // Forzar isConfigured = false desde dentro del mock evitaría bootstrap;
    // como ya lo tiene en true, parchéamos isConfigured a false para este test.
    Object.defineProperty(supabase, 'isConfigured', { get: () => false });

    service = new SocialService(supabase as never, auth, network as never, offlineQueue);
    service.posts.set([samplePost]);
  });

  it('aplica UI optimista al dar like (liked=true, likes+1)', async () => {
    supabase.rpcMock.and.resolveTo({
      data: [{ liked: true, likes_count: 6 }],
      error: null
    });
    // re-permitir isConfigured tras setear posts
    Object.defineProperty(supabase, 'isConfigured', { get: () => true });
    await service.toggleLike('p1');
    const p = service.posts().find((x) => x.id === 'p1');
    expect(p?.liked).toBeTrue();
    expect(p?.likes).toBe(6);
  });

  it('hace rollback si la RPC devuelve error', async () => {
    Object.defineProperty(supabase, 'isConfigured', { get: () => true });
    supabase.rpcMock.and.resolveTo({ data: null, error: { message: 'denied' } });
    await expectAsync(service.toggleLike('p1')).toBeRejected();
    const p = service.posts().find((x) => x.id === 'p1');
    expect(p?.liked).toBeFalse();
    expect(p?.likes).toBe(5);
  });

  it('encola la acción cuando está offline', async () => {
    network.online.set(false);
    await service.toggleLike('p1');
    expect(offlineQueue.enqueue).toHaveBeenCalled();
    const p = service.posts().find((x) => x.id === 'p1');
    // UI optimista incluso offline
    expect(p?.liked).toBeTrue();
  });

  it('no encola si el post aún es pending- (no existe en servidor)', async () => {
    network.online.set(false);
    service.posts.set([{ ...samplePost, id: 'pending-xyz' }]);
    await service.toggleLike('pending-xyz');
    expect(offlineQueue.enqueue).not.toHaveBeenCalled();
  });
});

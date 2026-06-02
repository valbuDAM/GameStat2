import { FollowService } from './follow.service';
import { SupabaseServiceMock } from '../../../testing/supabase.mock';
import { AuthService } from './auth.service';

describe('FollowService.getStats', () => {
  let supabase: SupabaseServiceMock;
  let auth: jasmine.SpyObj<AuthService>;
  let service: FollowService;

  beforeEach(() => {
    supabase = new SupabaseServiceMock();
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['currentUser', 'waitUntilReady']);
    auth.currentUser.and.returnValue({ id: 'me', name: 'me', email: 'm@m', avatar: '' } as never);
    auth.waitUntilReady.and.resolveTo();

    service = new FollowService(supabase as never, auth);
  });

  it('combina get_follow_counts + is_following en una sola estructura', async () => {
    supabase.rpcMock.and.callFake((name: string) => {
      if (name === 'get_follow_counts') {
        return Promise.resolve({
          data: [{ followers_count: 12, following_count: 3 }],
          error: null
        });
      }
      if (name === 'is_following') {
        return Promise.resolve({ data: true, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const stats = await service.getStats('other');
    expect(stats.followers).toBe(12);
    expect(stats.following).toBe(3);
    expect(stats.isFollowing).toBeTrue();
  });

  it('no llama is_following cuando el target es uno mismo', async () => {
    supabase.rpcMock.and.resolveTo({
      data: [{ followers_count: 0, following_count: 0 }],
      error: null
    });

    const stats = await service.getStats('me');
    expect(stats.isFollowing).toBeFalse();
    const calls = supabase.rpcMock.calls.allArgs().map((a) => a[0] as string);
    expect(calls).not.toContain('is_following');
  });

  it('propaga errores con mensaje legible', async () => {
    supabase.rpcMock.and.resolveTo({
      data: null,
      error: { message: 'rpc failure' }
    });
    await expectAsync(service.getStats('other')).toBeRejectedWithError(/rpc failure/);
  });
});

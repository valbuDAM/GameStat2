import { SupabaseService } from '../app/core/services/supabase.service';

/**
 * Mock minimalista de `SupabaseService` para tests unitarios.
 *
 * Cada método devuelve un thenable (`{ then(): Promise<{ data, error }> }`)
 * que imita la firma del cliente `@supabase/supabase-js` sin red real.
 *
 * Uso típico en specs:
 *
 *   const supabase = new SupabaseServiceMock();
 *   supabase.rpcMock = jasmine.createSpy('rpc').and.resolveTo({ data: 1, error: null });
 *   const svc = new XxxService(supabase as unknown as SupabaseService, ...);
 */

interface RpcResult { data: unknown; error: { message: string } | null }

export class SupabaseServiceMock {
  rpcMock: jasmine.Spy = jasmine.createSpy('rpc').and.resolveTo({ data: null, error: null } as RpcResult);
  fromMock: jasmine.Spy = jasmine.createSpy('from').and.callFake(() => this.createQueryBuilder());

  readonly client = {
    rpc: (...args: unknown[]): Promise<RpcResult> => this.rpcMock(...args),
    from: (table: string): unknown => this.fromMock(table),
    channel: (name: string): unknown => this.createChannel(name),
    removeChannel: (): Promise<void> => Promise.resolve(),
    auth: {
      onAuthStateChange: (): { data: { subscription: { unsubscribe(): void } } } => ({
        data: { subscription: { unsubscribe: (): void => undefined } }
      }),
      getSession: (): Promise<{ data: { session: unknown } }> => Promise.resolve({ data: { session: null } }),
      signInWithPassword: jasmine.createSpy('signInWithPassword').and.resolveTo({ data: { user: null }, error: null }),
      signUp: jasmine.createSpy('signUp').and.resolveTo({ data: { user: null }, error: null }),
      signOut: jasmine.createSpy('signOut').and.resolveTo({ error: null })
    }
  };

  get isConfigured(): boolean { return true; }
  assertConfigured(): typeof this.client { return this.client; }

  /** Crea un query builder encadenable cuyo resultado es configurable. */
  result: RpcResult = { data: null, error: null };
  setResult(result: RpcResult): void { this.result = result; }

  private createQueryBuilder(): Record<string, unknown> {
    const builder: Record<string, unknown> = {};
    const chain = ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'range', 'gte', 'lte', 'is', 'single', 'maybeSingle'];
    chain.forEach((fn) => {
      builder[fn] = (..._args: unknown[]): Record<string, unknown> => builder;
    });
    builder['then'] = (resolve: (v: RpcResult) => unknown): unknown =>
      resolve(this.result);
    return builder;
  }

  private createChannel(_name: string): Record<string, unknown> {
    const channel: Record<string, unknown> = {};
    channel['on'] = (..._args: unknown[]): Record<string, unknown> => channel;
    channel['subscribe'] = (cb?: (status: string) => void): Record<string, unknown> => {
      if (cb) cb('SUBSCRIBED');
      return channel;
    };
    channel['track'] = (): Promise<unknown> => Promise.resolve();
    channel['unsubscribe'] = (): Promise<unknown> => Promise.resolve();
    channel['presenceState'] = (): Record<string, unknown> => ({});
    return channel;
  }
}

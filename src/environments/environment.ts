const runtime = (globalThis as { __env?: { supabase?: { url?: string; anonKey?: string }; rawg?: { apiKey?: string } } }).__env ?? {};
const supabase = runtime.supabase ?? {};
const rawg = runtime.rawg ?? {};

export const environment = {
  production: false,
  rawg: {
    apiUrl: 'https://api.rawg.io/api',
    apiKey: rawg.apiKey ?? '',
    pageSize: 20,
    syncWithSupabase: true
  },
  supabase: {
    url: supabase.url ?? '',
    anonKey: supabase.anonKey ?? ''
  }
};

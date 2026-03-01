/**
 * Supabase Authentication Setup
 * Simple Google OAuth authentication for MiniClaw-CC
 * When VITE_SUPABASE_URL is not set, a no-op client is used so the app still loads.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const noopUnsubscribe = { unsubscribe: () => {} };

function createSupabaseClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are not set. Google auth will be disabled.');
    return {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signInWithOAuth: () => Promise.resolve({ data: { provider: 'google', url: null }, error: new Error('Auth not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the static site environment.') }),
        onAuthStateChange: () => ({ data: { subscription: noopUnsubscribe } }),
      },
    } as unknown as SupabaseClient;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      flowType: 'pkce',
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
}

export const supabase = createSupabaseClient();

export const authConfig = {
  providers: [
    {
      id: 'google',
      name: 'Google',
      icon: 'https://authjs.dev/img/providers/google.svg',
    },
  ],
};

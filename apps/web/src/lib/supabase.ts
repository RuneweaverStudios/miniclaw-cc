/**
 * Supabase Authentication Setup
 * Simple Google OAuth authentication for MiniClaw-CC
 */

import { createClient } from '@supabase/supabase-js';

// TODO: Replace with your actual Supabase project URL
// Get these from: https://supabase.com/dashboard/project/_/settings/api
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.warn('VITE_SUPABASE_URL is not set. Please configure Supabase.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce', // Recommended for web apps
    detectSessionInUrl: true,
    persistSession: true,
  },
});

// Auth helper functions
export const authConfig = {
  providers: [
    {
      id: 'google',
      name: 'Google',
      icon: 'https://authjs.dev/img/providers/google.svg',
    },
  ],
};

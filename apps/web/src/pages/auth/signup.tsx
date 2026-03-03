import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export function Signup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check for existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });

    // Handle OAuth redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          // User just signed in, sync with our backend
          await syncUserWithBackend(session.user);
          navigate('/dashboard');
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const syncUserWithBackend = async (user: User) => {
    try {
      // Sync user with MiniClaw backend
      const apiBase = import.meta.env.VITE_API_URL || '';
      const syncUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/api/auth/sync` : '/api/auth/sync';
      const response = await fetch(syncUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: user.email,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          avatar: user.user_metadata?.avatar_url,
          provider: 'google',
          providerId: user.id,
        }),
      });

      if (response.ok) {
        const { user: syncedUser, token } = await response.json();

        // Store the JWT token for API authentication
        localStorage.setItem('auth_token', token);
        localStorage.setItem('user_role', syncedUser.plan || 'free');
        localStorage.setItem('user_id', syncedUser.id);
      } else {
        console.error('Failed to sync user with backend');
      }
    } catch (err) {
      console.error('Error syncing user:', err);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');

    try {
      const origin = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, '');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        setError('Failed to sign in with Google. Please try again.');
        console.error('OAuth error:', error);
      }
    } catch (err) {
      setError('An unexpected error occurred.');
      console.error('Sign in error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900">
            Welcome to MiniClaw
          </h1>
          <p className="mt-3 text-lg text-gray-600">
            Get instant access to pre-provisioned AI agent servers
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Sign In Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-gray-900">
              Create your account
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              One-click signup with Google
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 border-2 border-gray-300 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 2.92v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                className="group-hover:opacity-80"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v4.72c2.16 2.97 5.62 4.73 9.82 4.73z"
                className="group-hover:opacity-80"
              />
              <path
                fill="#FBBC05"
                d="M3.58 13.5c0-1.07.24-2.15.68-3.15l3.57-2.77c1.35 1.05 2.48 2.92 2.68 4.53h3.57V13.5H3.58z"
              />
            </svg>
            <span className="text-base font-medium text-gray-700">
              {loading ? 'Signing in...' : 'Continue with Google'}
            </span>
          </button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">
                Powered by Supabase
              </span>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center">
              <div className="text-2xl mb-1">⚡</div>
              <div className="text-xs text-gray-600">Instant Setup</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">🔒</div>
              <div className="text-xs text-gray-600">Secure Auth</div>
            </div>
            <div className="text-center">
              <div className="text-2xl mb-1">🚀</div>
              <div className="text-xs text-gray-600">Quick Deploy</div>
            </div>
          </div>
        </div>

        {/* Already have account? */}
        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

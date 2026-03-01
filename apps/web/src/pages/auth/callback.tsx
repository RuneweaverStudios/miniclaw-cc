import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

export function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Supabase handles the OAuth callback automatically
        // Wait for session to be established
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          // Get wizard preferences from URL params
          const framework = searchParams.get('framework') || 'nanobot';
          const model = searchParams.get('model') || 'minimax/minimax-m2.5';
          const channel = searchParams.get('channel') || 'telegram';

          // Sync user with backend and get JWT token (use API base URL when frontend is on different domain)
          const apiBase = import.meta.env.VITE_API_URL || '';
          const syncUrl = apiBase ? `${apiBase.replace(/\/$/, '')}/auth/sync` : '/api/auth/sync';
          const response = await fetch(syncUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: session.user.email,
              name: session.user.user_metadata?.name || session.user.email?.split('@')[0],
              avatar: session.user.user_metadata?.avatar_url,
              provider: 'google',
              providerId: session.user.id,
              metadata: {
                framework,
                model,
                channel,
              },
            }),
          });

          if (response.ok) {
            const { user, token } = await response.json();

            // Store the JWT token for API authentication
            localStorage.setItem('auth_token', token);
            localStorage.setItem('user_role', user.plan || 'free');
            localStorage.setItem('user_id', user.id);

            // Store wizard preferences
            localStorage.setItem('wizard_framework', framework);
            localStorage.setItem('wizard_model', model);
            localStorage.setItem('wizard_channel', channel);

            setStatus('success');
            setTimeout(() => navigate('/checkout', { replace: true }), 500);
          } else {
            const raw = await response.text();
            let errBody: Record<string, unknown> = {};
            try {
              errBody = raw ? JSON.parse(raw) : {};
            } catch {
              errBody = { raw };
            }
            const errMsg = (errBody?.error as { message?: string })?.message ?? (errBody?.message as string) ?? `HTTP ${response.status}`;
            console.error('Failed to sync user with backend:', errMsg, raw || '(empty body)', errBody);
            setStatus('error');
            setTimeout(() => navigate('/', { replace: true }), 2000);
          }
        } else {
          setStatus('error');
          setTimeout(() => navigate('/', { replace: true }), 2000);
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setTimeout(() => navigate('/', { replace: true }), 2000);
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      <div className="text-center">
        {status === 'loading' && (
          <div className="space-y-4">
            <div className="animate-spin w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
            <p className="text-gray-600">Signing you in...</p>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="text-5xl">✅</div>
            <p className="text-xl font-semibold text-gray-900">Welcome!</p>
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="text-5xl">❌</div>
            <p className="text-xl font-semibold text-red-600">Authentication Failed</p>
            <p className="text-gray-600">Redirecting back to signup...</p>
          </div>
        )}
      </div>
    </div>
  );
}

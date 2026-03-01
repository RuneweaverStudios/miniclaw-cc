import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, AlertCircle } from 'lucide-react';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [deploying, setDeploying] = useState(true);
  const [error, setError] = useState('');
  const sessionId = searchParams.get('session_id');

  // Use ref to track if we've already processed this checkout session
  // This prevents double-calling the API due to React 18 StrictMode double-mount
  const processedRef = useRef<string | null>(null);

  useEffect(() => {
    const processCheckout = async () => {
      // Prevent duplicate processing of the same sessionId
      // This handles React 18 StrictMode's double-mount behavior
      const currentSessionId = sessionId || 'no-session';

      // Check ref first (in-memory)
      if (processedRef.current === currentSessionId) {
        console.log('[CheckoutSuccess] Ref check: Already processed this session, skipping');
        return;
      }

      // Also check localStorage as backup (persists across unmount/remount)
      const processingKey = `processing_${currentSessionId}`;
      const alreadyProcessing = localStorage.getItem(processingKey);
      if (alreadyProcessing) {
        console.log('[CheckoutSuccess] localStorage check: Already processing this session, skipping');
        return;
      }

      // Mark as processing in both ref and localStorage
      processedRef.current = currentSessionId;
      localStorage.setItem(processingKey, Date.now().toString());

      console.log('[CheckoutSuccess] First time processing this session, proceeding...');

      try {
        // Get wizard selections from localStorage
        const framework = localStorage.getItem('wizard_framework') || 'nanobot';
        const model = localStorage.getItem('wizard_model') || 'minimax/minimax-m2.5';
        const channel = localStorage.getItem('wizard_channel') || 'telegram';
        const plan = localStorage.getItem('selected_plan') || 'nanobot';

        console.log('[CheckoutSuccess] Processing checkout with:', {
          sessionId: currentSessionId,
          framework,
          model,
          channel,
          plan,
        });

        // Verify checkout session and deploy server
        const response = await fetch('/api/billing/checkout-success', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          },
          body: JSON.stringify({
            sessionId,
            plan,
            framework,
            model,
            channel,
          }),
        });

        if (response.ok) {
          const { server, subscription } = await response.json();
          localStorage.setItem('deployed_server', JSON.stringify(server));
          localStorage.setItem('subscription', JSON.stringify(subscription));
          setDeploying(false);

          // Clear processing flag
          localStorage.removeItem(processingKey);

          console.log('[CheckoutSuccess] ✓ Allocation successful, redirecting to /deploy in 1.5s');
          // Redirect to deploy wizard for bot pairing
          setTimeout(() => {
            navigate('/deploy');
          }, 1500);
        } else {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          const errorMessage = typeof errorData?.error === 'string' ? errorData.error : errorData?.reason || 'Failed to process checkout';
          console.error('[CheckoutSuccess] ✗ API error:', errorData);

          // Check if we already have a deployed_server in localStorage (from successful first call)
          const existingServer = localStorage.getItem('deployed_server');
          if (existingServer) {
            console.log('[CheckoutSuccess] Found existing server in localStorage, ignoring error and redirecting');
            setDeploying(false);
            localStorage.removeItem(processingKey); // Clear processing flag
            setTimeout(() => {
              navigate('/deploy');
            }, 1500);
            return;
          }

          // Only show error if we don't have a server already
          setError(errorMessage);
          setDeploying(false);
          localStorage.removeItem(processingKey); // Clear processing flag

          // Still redirect after showing error briefly (for debugging)
          setTimeout(() => {
            console.log('[CheckoutSuccess] Error redirect to /deploy');
            navigate('/deploy');
          }, 3000);
        }
      } catch (err) {
        console.error('Checkout processing error:', err);
        setError('Connection error. Please try again.');
        setDeploying(false);
        localStorage.removeItem(processingKey); // Clear processing flag

        // Fallback: still try to continue to deploy
        setTimeout(() => {
          navigate('/deploy');
        }, 3000);
      }
    };

    // Always process checkout, with or without sessionId
    processCheckout();
  }, [navigate, sessionId]);

  const handleContinueNow = () => {
    navigate('/deploy');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="mx-auto max-w-lg px-4 py-12 text-center">
        {deploying ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-sky-500 border-t-transparent" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Setting Up Your Server...</h1>
              <p className="mt-2 text-zinc-400">Deploying your AI assistant. This usually takes less than a minute.</p>
            </div>
          </div>
        ) : error ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-500/20">
                <AlertCircle className="h-10 w-10 text-amber-400" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-amber-400">Almost There!</h1>
              <p className="mt-2 text-zinc-400">{error}</p>
              <p className="mt-4 text-sm text-zinc-500">Redirecting to setup...</p>
            </div>
            <button
              onClick={handleContinueNow}
              className="mt-4 rounded-lg bg-sky-500 px-6 py-2 text-white hover:bg-sky-400 transition"
            >
              Continue to Setup
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Payment Successful!</h1>
              <p className="mt-2 text-zinc-400">Your server is ready! Redirecting to setup...</p>
            </div>
            <button
              onClick={handleContinueNow}
              className="mt-4 rounded-lg bg-sky-500 px-6 py-2 text-white hover:bg-sky-400 transition"
            >
              Continue Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

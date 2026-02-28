import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

export function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [deploying, setDeploying] = useState(true);
  const [sessionId] = useState(searchParams.get('session_id'));

  useEffect(() => {
    const processCheckout = async () => {
      try {
        // Get wizard selections from localStorage
        const framework = localStorage.getItem('wizard_framework') || 'nanobot';
        const model = localStorage.getItem('wizard_model') || 'minimax/minimax-m2.5';
        const channel = localStorage.getItem('wizard_channel') || 'telegram';
        const plan = localStorage.getItem('selected_plan') || 'nanobot';

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

          // Redirect to deploy wizard for bot allocation and Telegram pairing
          setTimeout(() => {
            navigate('/deploy');
          }, 2000);
        } else {
          console.error('Failed to process checkout');
          setDeploying(false);
        }
      } catch (error) {
        console.error('Checkout processing error:', error);
        setDeploying(false);
      }
    };

    if (sessionId) {
      processCheckout();
    }
  }, [sessionId, navigate]);

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
        ) : (
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
                <CheckCircle className="h-10 w-10 text-emerald-400" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Payment Successful!</h1>
              <p className="mt-2 text-zinc-400">Your server is ready! Continuing to setup...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

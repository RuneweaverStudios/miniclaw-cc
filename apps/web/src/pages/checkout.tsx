import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const MODEL_INFO: Record<string, { name: string; tag: string; pricing: string }> = {
  'minimax/minimax-m2.5': {
    name: 'MiniMax M2.5',
    tag: 'Best Value',
    pricing: '$30/M input · $110/M output'
  },
  'anthropic/claude-3.5-haiku': {
    name: 'Claude 3.5 Haiku',
    tag: 'Fast',
    pricing: '$25/M input · $125/M output'
  },
  'anthropic/claude-sonnet-4': {
    name: 'Claude Sonnet 4',
    tag: 'Balanced',
    pricing: '$300/M input · $1500/M output'
  },
  'openai/gpt-4o': {
    name: 'GPT-4o',
    tag: 'Creative',
    pricing: '$200/M input · $800/M output'
  },
};

const FRAMEWORK_INFO = {
  nanobot: {
    name: 'Nanobot',
    description: 'Ultra-lightweight Python agent',
    benefits: ['~4k lines of code', 'Telegram long-poll', 'MCP support', 'Easy to extend']
  },
  openclaw: {
    name: 'OpenClaw',
    description: 'Full-featured Node.js agent',
    benefits: ['Browser dashboard', 'Webhook routing', 'Mature ecosystem', 'TypeScript friendly']
  },
};

const PLAN_INFO = {
  free: {
    name: 'Free Trial',
    price: '$0',
    period: '7 days',
    features: ['7 day trial', '$25 token allocation', '1 server', 'Telegram channel', 'All models available']
  },
  basic: {
    name: 'Basic',
    price: '$5',
    period: '/month',
    features: ['$25 monthly token allocation', '1 dedicated server', 'Telegram channel', 'All models available', 'Cancel anytime']
  },
  pro: {
    name: 'Pro',
    price: '$15',
    period: '/month',
    features: ['$75 monthly token allocation', '2 dedicated servers', 'Telegram + Discord', 'Priority support', 'Cancel anytime']
  },
};

type Plan = 'free' | 'basic' | 'pro';

export function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('basic');

  // Get wizard selections from localStorage (set during auth callback)
  const [framework, setFramework] = useState('');
  const [model, setModel] = useState('');
  const [channel, setChannel] = useState('');

  useEffect(() => {
    setFramework(localStorage.getItem('wizard_framework') || 'nanobot');
    setModel(localStorage.getItem('wizard_model') || 'minimax/minimax-m2.5');
    setChannel(localStorage.getItem('wizard_channel') || 'telegram');
  }, []);

  const modelDetails = MODEL_INFO[model];
  const frameworkDetails = FRAMEWORK_INFO[framework as keyof typeof FRAMEWORK_INFO];
  const planDetails = PLAN_INFO[selectedPlan];

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // Create Stripe checkout session
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          plan: selectedPlan,
          framework,
          model,
          channel,
          successUrl: `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/checkout`,
        }),
      });

      if (response.ok) {
        const { checkoutUrl } = await response.json();
        window.location.href = checkoutUrl;
      } else {
        const error = await response.json();
        console.error('Checkout error:', error);
        alert('Failed to create checkout session. Please try again.');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      alert('Failed to create checkout session. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Complete Your Deployment</h1>
          <p className="mt-2 text-zinc-400">Review your selections and choose a plan to deploy your AI assistant</p>
        </div>

        {/* Selection Summary */}
        <div className="mb-8 rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Your Selection</h2>

          {/* Framework */}
          <div className="mb-4 flex items-start justify-between border-b border-zinc-800 pb-4">
            <div>
              <p className="text-sm text-zinc-400">Assistant</p>
              <p className="text-lg font-medium text-white">{frameworkDetails?.name}</p>
              <p className="text-sm text-zinc-500">{frameworkDetails?.description}</p>
            </div>
          </div>

          {/* Model */}
          <div className="mb-4 flex items-start justify-between border-b border-zinc-800 pb-4">
            <div>
              <p className="text-sm text-zinc-400">Model</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-lg font-medium text-white">{modelDetails?.name}</p>
                <span className="text-xs bg-sky-500/25 text-sky-300 px-2 py-0.5 rounded">{modelDetails?.tag}</span>
              </div>
              <p className="text-sm text-zinc-500 mt-1">{modelDetails?.pricing}</p>
            </div>
          </div>

          {/* Channel */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-zinc-400">Channel</p>
              <p className="text-lg font-medium text-white capitalize">{channel}</p>
            </div>
          </div>
        </div>

        {/* Plan Selection */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Choose Your Plan</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {(Object.keys(PLAN_INFO) as Plan[]).map((plan) => {
              const info = PLAN_INFO[plan];
              const isSelected = selectedPlan === plan;
              return (
                <button
                  key={plan}
                  type="button"
                  onClick={() => setSelectedPlan(plan)}
                  className={`rounded-xl border p-5 text-left transition ${
                    isSelected
                      ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                      : 'border-zinc-700/80 bg-zinc-900/50 hover:border-zinc-600 hover:bg-zinc-800/70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white">{info.name}</h3>
                    {isSelected && (
                      <svg className="h-5 w-5 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-white mb-1">{info.price}<span className="text-base font-normal text-zinc-400">{info.period}</span></p>
                  <ul className="space-y-1 text-sm text-zinc-400">
                    {info.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <svg className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>
        </div>

        {/* What You Get */}
        <div className="mb-8 rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">What You'll Get</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20">
                <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 12h14" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Instant Server Deployment</p>
                <p className="text-xs text-zinc-400">Your {frameworkDetails?.name} server deployed in seconds, not hours</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20">
                <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 12h14" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{modelDetails?.name} Configured</p>
                <p className="text-xs text-zinc-400">Your chosen model set as default, ready to use</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20">
                <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 12h14" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">{channel} Connected</p>
                <p className="text-xs text-zinc-400">Start chatting immediately after deployment</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-500/20">
                <svg className="h-3 w-3 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path d="M5 12h14" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-white">Token Allocation</p>
                <p className="text-xs text-zinc-400">{selectedPlan === 'basic' ? '$25' : selectedPlan === 'pro' ? '$75' : '$25'} monthly credits included</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full max-w-md rounded-xl border border-sky-500 bg-sky-500 px-8 py-4 text-lg font-semibold text-white shadow-lg hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? 'Creating checkout...' : `Pay ${planDetails.price} and Deploy`}
          </button>

          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm text-zinc-400 hover:text-white transition"
          >
            Cancel and go back
          </button>

          <p className="text-center text-xs text-zinc-500">
            Secure checkout powered by Stripe. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
}

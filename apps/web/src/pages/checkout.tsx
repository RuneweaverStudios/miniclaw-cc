import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const MODEL_INFO: Record<string, { name: string; tag: string; pricing: string }> = {
  'minimax/minimax-m2.5': {
    name: 'MiniMax M2.5',
    tag: 'Best Value',
    pricing: '$0.45/M input · $1.80/M output' // Live from OpenRouter × 1.5
  },
  'anthropic/claude-3.5-haiku': {
    name: 'Claude 3.5 Haiku',
    tag: 'Fast',
    pricing: '$1.20/M input · $6.00/M output' // Live from OpenRouter × 1.5
  },
  'moonshotai/kimi-k2.5': {
    name: 'Kimi K2.5',
    tag: 'Top Ranked',
    pricing: '$0.68/M input · $3.30/M output' // Live from OpenRouter × 1.5
  },
  'qwen/qwen3.5-flash-02-23': {
    name: 'Qwen 3.5 Flash',
    tag: 'Ultra Fast',
    pricing: '$0.15/M input · $0.60/M output' // Live from OpenRouter × 1.5
  },
  'anthropic/claude-sonnet-4': {
    name: 'Claude Sonnet 4',
    tag: 'Balanced',
    pricing: '$4.50/M input · $22.50/M output' // Live from OpenRouter × 1.5
  },
  'z-ai/glm-5': {
    name: 'GLM-5',
    tag: 'Chinese Powerhouse',
    pricing: '$1.43/M input · $3.83/M output' // Live from OpenRouter × 1.5
  },
  'openai/gpt-4o': {
    name: 'GPT-4o',
    tag: 'Creative',
    pricing: '$3.75/M input · $15.00/M output' // Live from OpenRouter × 1.5
  },
  'anthropic/claude-opus-4.5': {
    name: 'Claude Opus 4.5',
    tag: 'Premium',
    pricing: '$7.50/M input · $37.50/M output' // Live from OpenRouter × 1.5
  },
  'openai/gpt-oss-120b': {
    name: 'GPT-OSS 120B',
    tag: 'Experimental',
    pricing: '$0.06/M input · $0.29/M output' // Live from OpenRouter × 1.5
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
  nanobot: {
    name: 'Nanobot',
    price: '$39',
    period: '/month',
    features: ['$25 token credit included', 'Nanobot framework', '2GB RAM server', 'Telegram channel', 'All models available', 'Pay only for what you use']
  },
  openclaw: {
    name: 'OpenClaw',
    price: '$59',
    period: '/month',
    features: ['$25 token credit included', 'OpenClaw framework', '4GB RAM server', 'Telegram + Discord', 'Browser dashboard', 'Pay only for what you use']
  },
};

type Plan = 'nanobot' | 'openclaw';

export function Checkout() {
  const navigate = useNavigate();
  const [_searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan>('nanobot');
  const [showModelSelector, setShowModelSelector] = useState(false);

  // Get wizard selections from localStorage (set during auth callback)
  const [framework, setFramework] = useState('');
  const [model, setModel] = useState('');
  const [channel, setChannel] = useState('');

  useEffect(() => {
    const savedFramework = localStorage.getItem('wizard_framework') || 'nanobot';
    setFramework(savedFramework);
    setModel(localStorage.getItem('wizard_model') || 'minimax/minimax-m2.5');
    setChannel(localStorage.getItem('wizard_channel') || 'telegram');
    // Sync selectedPlan with framework
    setSelectedPlan(savedFramework as Plan);
  }, []);

  const modelDetails = MODEL_INFO[model] || {
    name: model.split('/').pop()?.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || model,
    tag: 'Available',
    pricing: 'Contact for pricing'
  };
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
        // Save selected plan for retrieval after Stripe redirect
        localStorage.setItem('selected_plan', selectedPlan);
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
            <button
              onClick={() => setShowModelSelector(true)}
              className="text-sm text-sky-400 hover:text-sky-300 transition-colors"
            >
              Change
            </button>
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
                  onClick={() => {
                    setSelectedPlan(plan);
                    // Update wizard_framework to match selected plan
                    localStorage.setItem('wizard_framework', plan);
                    setFramework(plan);
                  }}
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
                <p className="text-xs text-zinc-400">$25 monthly token credit included. Pay only for what you use beyond that.</p>
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

      {/* Model Selector Modal */}
      {showModelSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-xl bg-zinc-900 border border-zinc-800 p-6">
            <div className="mb-4">
              <h3 className="text-xl font-semibold text-white">Select AI Model</h3>
              <p className="text-sm text-zinc-400 mt-1">Choose the AI model for your agent</p>
            </div>

            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {Object.entries(MODEL_INFO).map(([id, info]) => (
                <button
                  key={id}
                  onClick={() => {
                    setModel(id);
                    localStorage.setItem('wizard_model', id);
                    setShowModelSelector(false);
                  }}
                  className={`w-full text-left rounded-lg border p-4 transition ${
                    model === id
                      ? 'border-sky-500 bg-sky-500/10'
                      : 'border-zinc-700/80 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800/70'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{info.name}</p>
                        <span className="text-xs bg-sky-500/25 text-sky-300 px-2 py-0.5 rounded">{info.tag}</span>
                      </div>
                      <p className="text-sm text-zinc-400 mt-1">{info.pricing}</p>
                    </div>
                    {model === id && (
                      <svg className="h-5 w-5 text-sky-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModelSelector(false)}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-sm font-medium text-white hover:bg-zinc-800 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

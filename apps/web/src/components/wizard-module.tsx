import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

/** Official colorful Google G logo */
function GoogleGIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
    </span>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#0088cc">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    </span>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5 shrink-0 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/** Official Claude icon */
function ClaudeLogoIcon({ className }: { className?: string }) {
  return (
    <span className={className} aria-hidden>
      <svg width="20" height="20" viewBox="0 0 256 257" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="#D97757" d="m50.228 170.321l50.357-28.257l.843-2.463l-.843-1.361h-2.462l-8.426-.518l-28.775-.778l-24.952-1.037l-24.175-1.296l-6.092-1.297L0 125.796l.583-3.759l5.12-3.434l7.324.648l16.202 1.101l24.304 1.685l17.629 1.037l26.118 2.722h4.148l.583-1.685l-1.426-1.037l-1.101-1.037l-25.147-17.045l-27.22-18.017l-14.258-10.37l-7.713-5.25l-3.888-4.925l-1.685-10.758l7-7.713l9.397.649l2.398.648l9.527 7.323l20.35 15.75L94.817 91.9l3.889 3.24l1.555-1.102l.195-.777l-1.75-2.917l-14.453-26.118l-15.425-26.572l-6.87-11.018l-1.814-6.61c-.648-2.723-1.102-4.991-1.102-7.778l7.972-10.823L71.42 0l10.63 1.426l4.472 3.888l6.61 15.101l10.694 23.786l16.591 32.34l4.861 9.592l2.592 8.879l.973 2.722h1.685v-1.556l1.36-18.211l2.528-22.36l2.463-28.776l.843-8.1l4.018-9.722l7.971-5.25l6.222 2.981l5.12 7.324l-.713 4.73l-3.046 19.768l-5.962 30.98l-3.889 20.739h2.268l2.593-2.593l10.499-13.934l17.628-22.036l7.778-8.749l9.073-9.657l5.833-4.601h11.018l8.1 12.055l-3.628 12.443l-11.342 14.388l-9.398 12.184l-13.48 18.147l-8.426 14.518l.778 1.166l2.01-.194l30.46-6.481l16.462-2.982l19.637-3.37l8.88 4.148l.971 4.213l-3.5 8.62l-20.998 5.184l-24.628 4.926l-36.682 8.685l-.454.324l.519.648l16.526 1.555l7.065.389h17.304l32.21 2.398l8.426 5.574l5.055 6.805l-.843 5.184l-12.962 6.611l-17.498-4.148l-40.83-9.721l-14-3.5h-1.944v1.167l11.666 11.406l21.387 19.314l26.767 24.887l1.36 6.157l-3.434 4.86l-3.63-.518l-23.526-17.693l-9.073-7.972l-20.545-17.304h-1.36v1.814l4.73 6.935l25.017 37.59l1.296 11.536l-1.814 3.76l-6.481 2.268l-7.13-1.297l-14.647-20.544l-15.1-23.138l-12.185-20.739l-1.49.843l-7.194 77.448l-3.37 3.953l-7.778 2.981l-6.48-4.925l-3.436-7.972l3.435-15.749l4.148-20.544l3.37-16.333l3.046-20.285l1.815-6.74l-.13-.454l-1.49.194l-15.295 20.999l-23.267 31.433l-18.406 19.702l-4.407 1.75l-7.648-3.954l.713-7.064l4.277-6.286l25.47-32.405l15.36-20.092l9.917-11.6l-.065-1.686h-.583L44.07 198.125l-12.055 1.555l-5.185-4.86l.648-7.972l2.463-2.593l20.35-13.999z"/>
      </svg>
    </span>
  );
}

function ModelIcon({ type }: { type: 'claude' | 'openai' | 'minimax' | 'kimi' }) {
  const className = 'flex h-5 w-5 shrink-0 items-center justify-center text-[inherit]';
  if (type === 'claude') {
    return <ClaudeLogoIcon className={className} />;
  }
  if (type === 'openai') {
    return (
      <span className={`${className} text-white`} aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.4092-.6813zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.057L14.2676 4.05a4.4992 4.4992 0 0 1 6.6802 4.6767zm1.3932 4.0568l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.5158a4.4992 4.4992 0 0 1 3.2425 1.0175 4.4559 4.4559 0 0 1 .7572 3.2819l-1.9422.9849z"/>
        </svg>
      </span>
    );
  }
  if (type === 'minimax') {
    return (
      <span className={`${className} rounded bg-zinc-600 px-1 text-[10px] font-bold text-white`} aria-hidden>M</span>
    );
  }
  if (type === 'kimi') {
    return (
      <span className={`${className} rounded bg-rose-600 px-1 text-[10px] font-bold text-white`} aria-hidden>K</span>
    );
  }
  return null;
}

const FRAMEWORKS = [
  {
    id: 'nanobot',
    name: 'Nanobot',
    tagline: 'Ultra-lightweight, Python',
    benefits: [
      '~4k lines of code — minimal footprint, fast install',
      'Telegram via long-poll (no webhook required)',
      'MCP support, Discord, Slack, Feishu, DingTalk, WhatsApp',
      'Research-friendly; easy to read and extend',
    ],
  },
  {
    id: 'openclaw',
    name: 'OpenClaw',
    tagline: 'Full-featured, Node.js',
    benefits: [
      'Rich Control UI in the browser (dashboard on your instance)',
      'Webhook-based Telegram (messages routed through Miniclaw)',
      'Mature ecosystem and feature set',
      'Familiar for Node/TypeScript developers',
    ],
  },
] as const;

const CHANNELS = [
  { id: 'telegram', name: 'Telegram', available: true },
  { id: 'discord', name: 'Discord', available: false },
  { id: 'whatsapp', name: 'WhatsApp', available: false },
] as const;

const FEATURED_MODELS = [
  {
    id: 'minimax/minimax-m2.5',
    name: 'MiniMax M2.5',
    icon: 'minimax' as const,
    tag: 'Best Value',
    recommended: true,
    blurb: 'Best value for extended agent workloads',
    recommendedBlurb: 'Recommended for most users - great balance of cost and capability',
    input_per_million_cents: 30,
    output_per_million_cents: 110,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    icon: 'claude' as const,
    tag: 'Fast',
    blurb: 'Lightning-fast for simple tasks',
    input_per_million_cents: 25,
    output_per_million_cents: 125,
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    icon: 'claude' as const,
    tag: 'Balanced',
    blurb: 'Excellent at coding and complex tasks',
    input_per_million_cents: 300,
    output_per_million_cents: 1500,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    icon: 'openai' as const,
    tag: 'Creative',
    blurb: 'Flagship with multimodal capabilities',
    input_per_million_cents: 200,
    output_per_million_cents: 800,
  },
] as const;

function formatPricingLine(m: typeof FEATURED_MODELS[0]) {
  const inCents = m.input_per_million_cents * 1.5;
  const outCents = m.output_per_million_cents * 1.5;
  return `$${(inCents / 100).toFixed(2)}/M in, $${(outCents / 100).toFixed(2)}/M out`;
}

type ModelOption = (typeof FEATURED_MODELS)[0] & { pricingLine: string };

function sortByCostCheapestFirst(options: ModelOption[]): ModelOption[] {
  return [...options].sort(
    (a, b) =>
      a.input_per_million_cents + a.output_per_million_cents -
      (b.input_per_million_cents + b.output_per_million_cents)
  );
}

export function WizardModule() {
  const navigate = useNavigate();
  const [framework, setFramework] = useState<string>('nanobot');
  const [modelId, setModelId] = useState<string>(FEATURED_MODELS[0]?.id || '');
  const [channelId, setChannelId] = useState<string>('telegram');
  const [loaded, setLoaded] = useState(false);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const modelOptions: ModelOption[] = FEATURED_MODELS.map((m) => ({
    ...m,
    pricingLine: formatPricingLine(m),
  }));

  const sortedModelOptions = useMemo(() => sortByCostCheapestFirst(modelOptions), [modelOptions]);
  const selectedModel = modelOptions.find((m) => m.id === modelId) || sortedModelOptions[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    }
    if (modelDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [modelDropdownOpen]);

  useEffect(() => {
    // Check if user is already authenticated
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setLoaded(true);
      } else {
        setLoaded(true);
      }
    });
  }, []);

  const handleFramework = (id: string) => {
    setFramework(id);
  };

  const handleModel = (id: string) => {
    setModelId(id);
  };

  const handleGoogleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?framework=${framework}&model=${modelId}&channel=${channelId}`,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('OAuth error:', error);
      alert('Failed to sign in with Google. Please try again.');
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-6 shadow-xl sm:p-8">
        {/* Framework (Nanobot vs OpenClaw) */}
        <h3 className="text-base font-medium text-white">Choose your assistant</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Pick the runtime we install on your server. Both work with Telegram and your chosen model.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {FRAMEWORKS.map((fw) => {
            const selected = framework === fw.id;
            return (
              <button
                key={fw.id}
                type="button"
                onClick={() => handleFramework(fw.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/50'
                    : 'border-zinc-700/80 bg-zinc-800/50 hover:border-zinc-600 hover:bg-zinc-800/70'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{fw.name}</span>
                  {selected && <CheckIcon />}
                </div>
                <p className="mt-0.5 text-xs text-zinc-400">{fw.tagline}</p>
                <ul className="mt-2 space-y-1 text-xs text-zinc-500">
                  {fw.benefits.map((b, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-sky-400/80">•</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {/* Model selection – dropdown sorted cheapest to most expensive */}
        <h3 className="mt-8 text-base font-medium text-white">Which model do you want as default?</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Sorted by cost (cheapest first). All support tool calling.
        </p>
        <div className="mt-4 relative" ref={modelDropdownRef}>
          <button
            type="button"
            onClick={() => setModelDropdownOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-700/80 bg-zinc-800/50 px-4 py-3 text-left transition hover:border-zinc-600 hover:bg-zinc-800/70"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
              {selectedModel && <ModelIcon type={selectedModel.icon} />}
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-white">{selectedModel?.name ?? 'Select model'}</span>
                <span className="ml-2 text-xs text-zinc-400">{selectedModel?.tag ?? ''}</span>
                {selectedModel?.recommended && (
                  <span className="ml-2 inline-flex items-center rounded-md bg-emerald-500/25 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/50">
                    ★ Recommended
                  </span>
                )}
              </div>
              <span className="shrink-0 text-zinc-400" aria-hidden>
                <svg className={`h-5 w-5 transition ${modelDropdownOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </div>
          </button>
          {modelDropdownOpen && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-[min(20rem,70vh)] overflow-auto rounded-xl border border-zinc-700 bg-zinc-900 shadow-xl">
              {sortedModelOptions.map((m) => {
                const selected = modelId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      handleModel(m.id);
                      setModelDropdownOpen(false);
                    }}
                    className={`flex w-full flex-col gap-0.5 border-b border-zinc-800/80 px-4 py-3 text-left last:border-b-0 transition ${
                      selected ? 'bg-sky-500/10 ring-inset' : 'hover:bg-zinc-800/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <ModelIcon type={m.icon} />
                        <span className="text-sm font-medium text-white">{m.name}</span>
                        <span className="text-xs text-zinc-400">{m.tag}</span>
                        {m.recommended && (
                          <span className="inline-flex items-center rounded-md bg-emerald-500/25 px-2 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-400/50">
                            ★ Recommended
                          </span>
                        )}
                      </div>
                      {selected && <CheckIcon />}
                    </div>
                    {m.recommended && m.recommendedBlurb && (
                      <p className="text-xs font-medium text-emerald-300/95">{m.recommendedBlurb}</p>
                    )}
                    <p className="text-xs text-zinc-500">{m.blurb}</p>
                    <p className="text-xs text-zinc-600">{m.pricingLine}</p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Channel selection */}
        <h3 className="mt-8 text-base font-medium text-white">Which channel do you want to use for sending messages?</h3>
        <div className="mt-4 flex flex-wrap gap-3">
          {CHANNELS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              disabled={!ch.available}
              className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-3 transition ${
                ch.available
                  ? 'border-zinc-500 bg-zinc-800 hover:border-zinc-400'
                  : 'cursor-not-allowed border-zinc-700/60 bg-zinc-800/30 opacity-70'
              }`}
            >
              <div className="flex items-center gap-2">
                {ch.id === 'telegram' && <TelegramIcon />}
                <span className="text-sm font-medium text-white">{ch.name}</span>
              </div>
              {!ch.available && <span className="text-xs text-zinc-500">Coming soon</span>}
            </button>
          ))}
        </div>

        {/* Sign in with Google */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={!modelId}
            className="flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-600 bg-white py-3.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
          >
            <GoogleGIcon />
            Sign in with Google to deploy
          </button>
          <p className="mt-4 text-center text-sm text-zinc-500">
            Sign in with Google to deploy your AI assistant and connect your channels.
          </p>
          <p className="mt-1 text-center text-sm text-sky-400">
            Deploy in minutes
          </p>
        </div>
      </div>
    </div>
  );
}

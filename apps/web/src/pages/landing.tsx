import { useState } from 'react';
import { Link } from 'react-router-dom';
import { WizardModule } from '@/components/wizard-module';

const UPCHARGE = 1.5;
const ALLOCATION_CENTS = 2500; // $25
const STANDARD_INPUT_TOKENS = 2000;
const STANDARD_OUTPUT_TOKENS = 1000;

const MODEL_COMPARISON: Array<{
  id: string;
  name: string;
  pros: string[];
  cons: string[];
  input_per_million_cents: number;
  output_per_million_cents: number;
}> = [
  {
    id: 'minimax/minimax-m2.5',
    name: 'MiniMax M2.5',
    pros: ['Best value — tokens last longer', 'Strong for coding and agent workflows', 'Long context, competitive quality'],
    cons: ['Less familiar name than Claude or GPT'],
    // Base: ~$0.20/M in, ~$0.60/M out (OpenRouter) × 1.5 = $0.30/M, $0.90/M
    input_per_million_cents: 20,
    output_per_million_cents: 60,
  },
  {
    id: 'anthropic/claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    pros: ['Fast replies', 'Low cost', 'Good for simpler tasks and high volume'],
    cons: ['Less capable on very complex, multi-step reasoning'],
    // Base via OpenRouter: ~$0.025/M in, ~$0.125/M out × 1.5 = $0.04/M, $0.19/M
    input_per_million_cents: 3,
    output_per_million_cents: 13,
  },
  {
    id: 'anthropic/claude-sonnet-4',
    name: 'Claude Sonnet 4',
    pros: ['Strong balance of speed and capability', 'Great for coding and agentic tasks'],
    cons: ['Output tokens cost more; faster burn on long replies'],
    // Base: ~$3/M in, ~$15/M out (OpenRouter) × 1.5 = $4.50/M, $22.50/M
    input_per_million_cents: 300,
    output_per_million_cents: 1500,
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    pros: ['Flagship model', 'Creative and agentic', 'Excels at complex multi-step tasks'],
    cons: ['Can burn through tokens quickly on heavy agent loops'],
    // Base: $2.50/M in, $10/M out (OpenRouter) × 1.5 = $3.75/M, $15/M
    input_per_million_cents: 250,
    output_per_million_cents: 1000,
  },
  {
    id: 'moonshotai/kimi-k2.5',
    name: 'Kimi K2.5',
    pros: ['Long context', 'Strong reasoning', 'Native multimodal'],
    cons: ['Output tokens can add up on long answers'],
    input_per_million_cents: 50,
    output_per_million_cents: 240,
  },
  {
    id: 'anthropic/claude-opus-4.6',
    name: 'Claude Opus 4.6',
    pros: ['Most capable model', 'Best for complex reasoning and long outputs', 'Top-tier agentic performance'],
    cons: ['Fast token burn', 'Highest cost'],
    input_per_million_cents: 1500,
    output_per_million_cents: 7500,
  },
];

function projectedTokens(m: (typeof MODEL_COMPARISON)[0]) {
  const inCents = m.input_per_million_cents * UPCHARGE;
  const outCents = m.output_per_million_cents * UPCHARGE;
  const inputOnlyM = ALLOCATION_CENTS / inCents;
  const outputOnlyM = ALLOCATION_CENTS / outCents;
  const blendedM = (2 * ALLOCATION_CENTS) / (inCents + outCents);
  const costCentsPerInteraction =
    (STANDARD_INPUT_TOKENS * inCents + STANDARD_OUTPUT_TOKENS * outCents) / 1_000_000;
  const interactionsFor25 = costCentsPerInteraction > 0 ? ALLOCATION_CENTS / costCentsPerInteraction : 0;
  return { inputOnlyM, outputOnlyM, blendedM, costCentsPerInteraction, interactionsFor25 };
}

const TRADITIONAL_STEPS = [
  { label: 'Purchasing local virtual machine', min: 15 },
  { label: 'Creating SSH keys and storing securely', min: 10 },
  { label: 'Connecting to the server via SSH', min: 5 },
  { label: 'Installing Python and pip', min: 5 },
  { label: 'Installing Nanobot', min: 5 },
  { label: 'Setting up Nanobot', min: 5 },
  { label: 'Connecting to AI provider', min: 4 },
  { label: 'Pairing with Telegram', min: 4 },
] as const;

const USE_CASES = [
  'Code review & debugging', 'Research & summaries', 'Task automation', 'Data analysis',
  'Writing assistance', 'Documentation', 'Email drafting', 'Meeting notes',
  'Customer support', 'Content creation', 'Project management', 'Learning assistant',
  'API integration', 'Workflow optimization', 'Report generation', 'Knowledge base',
  'Technical support', 'Code refactoring', 'Testing assistance', 'Deployment helper',
  'System monitoring', 'Log analysis', 'Performance tuning', 'Security auditing',
  'CI/CD automation', 'Infrastructure management', 'Cloud optimization', 'DevOps helper',
  'Data processing', 'File conversion', 'Batch operations', 'Scheduled tasks',
  'Web scraping', 'Data extraction', 'Form filling', 'Website testing',
  'Chatbot integration', 'Voice assistant', 'Smart home control', 'IoT management',
  'Social media automation', 'Content scheduling', 'Analytics tracking', 'SEO optimization',
] as const;

export function Landing() {
  const [modelCompareId, setModelCompareId] = useState(MODEL_COMPARISON[0]?.id || '');
  const selectedModel = MODEL_COMPARISON.find((m) => m.id === modelCompareId) || MODEL_COMPARISON[0];
  const tokens = projectedTokens(selectedModel);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero – dark SimpleClaw-style */}
      <section className="bg-starry relative overflow-hidden px-4 py-24 text-white sm:py-32">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="animate-fade-in-up text-4xl font-bold tracking-tight sm:text-5xl">
            Deploy Nanobot or OpenClaw
            <br />
            <span className="text-zinc-400">under 1 minute</span>
          </h1>
          <p className="animate-fade-in-up animation-delay-100 mx-auto mt-6 max-w-2xl text-lg text-zinc-400">
            Choose your assistant below, pick a model, then one-click deploy your own 24/7 instance. No API keys or server setup.
          </p>
        </div>
        <div className="animate-fade-in-up animation-delay-200 mx-auto mt-12 max-w-2xl">
          <WizardModule />
        </div>
      </section>

      {/* What sets us apart */}
      <section className="border-t border-zinc-800 bg-zinc-950 py-16">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            What sets us apart from other 1-click AI assistant VPS?
          </h2>
          <ul className="mt-10 grid gap-6 text-left sm:grid-cols-2">
            <li className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-5">
              <strong className="text-white">No API keys.</strong>
              <span className="mt-1 block text-sm text-zinc-400">You pick a model; we run the LLM proxy. Your instance never sees or stores API keys—secure and zero setup.</span>
            </li>
            <li className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-5">
              <strong className="text-white">$25 in tokens every month.</strong>
              <span className="mt-1 block text-sm text-zinc-400">Included credits with transparent per-model pricing. Top up in your Profile anytime; no separate API billing.</span>
            </li>
            <li className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-5">
              <strong className="text-white">Your own VPS, Telegram pre-wired.</strong>
              <span className="mt-1 block text-sm text-zinc-400">Dedicated server, not shared. One flow: sign in, choose model, pay—then open Telegram and start chatting.</span>
            </li>
            <li className="rounded-xl border border-zinc-700/80 bg-zinc-900/50 p-5">
              <strong className="text-white">Choice + control.</strong>
              <span className="mt-1 block text-sm text-zinc-400">Tool-calling models including MiniMax M2, Claude, GPT-4o, Kimi. Profile shows usage, credits, and cancel anytime—no lock-in.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* Find the right model for you */}
      <section className="border-t border-zinc-800 bg-zinc-950 py-16" id="find-model">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="animate-fade-in-up text-center text-2xl font-semibold text-white sm:text-3xl">
            Find the right model for you
          </h2>
          <p className="animate-fade-in-up animation-delay-100 mt-2 text-center text-zinc-400">
            Compare pros and cons and see how far your $25 monthly allocation goes.
          </p>
          <div className="animate-fade-in-up animation-delay-200 mt-8">
            <select
              value={modelCompareId}
              onChange={(e) => setModelCompareId(e.target.value)}
              className="w-full rounded-xl border border-zinc-600 bg-zinc-800/80 px-4 py-3 text-white focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30"
            >
              {MODEL_COMPARISON.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === 'minimax/minimax-m2.5' ? ' (recommended)' : ''}
                </option>
              ))}
            </select>
            <div
              key={modelCompareId}
              className="animate-model-content-in mt-6 rounded-xl border border-zinc-700/80 bg-zinc-900/60 p-6"
            >
              <h3 className="text-lg font-medium text-white">{selectedModel.name}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-emerald-400/90">Pros</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
                    {selectedModel.pros.map((p, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-emerald-500" aria-hidden>+</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-amber-400/90">Cons</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
                    {selectedModel.cons.map((c, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-500" aria-hidden>−</span>
                        {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-6 rounded-lg border border-zinc-700/80 bg-zinc-800/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">With $25/month allocation (approx.)</p>
                <p className="mt-2 text-lg font-semibold text-white">
                  ~{tokens.blendedM.toFixed(1)} million tokens
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  (typical mix of input and output) · Input-only: ~{tokens.inputOnlyM.toFixed(1)}M · Output-only: ~{tokens.outputOnlyM.toFixed(1)}M
                </p>
              </div>
              <div className="mt-4 rounded-lg border border-zinc-700/80 bg-zinc-800/50 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Average agent interaction</p>
                <p className="mt-2 text-sm text-zinc-300">
                  {STANDARD_INPUT_TOKENS.toLocaleString()} input + {STANDARD_OUTPUT_TOKENS.toLocaleString()} output tokens
                  {' '}(~${tokens.costCentsPerInteraction.toFixed(2)} per interaction)
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  ~{Math.round(tokens.interactionsFor25).toLocaleString()} interactions for $25
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparison – Traditional vs Miniclaw */}
      <section className="border-t border-zinc-800 bg-zinc-950 py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="animate-fade-in-up text-center text-2xl font-semibold text-white sm:text-3xl">
            Traditional Method vs Miniclaw
          </h2>
          <div className="animate-fade-in-up animation-delay-100 mt-12 grid gap-0 sm:grid-cols-2">
            {/* Traditional column */}
            <div className="border-b border-zinc-800 p-8 sm:border-b-0 sm:border-r sm:pr-12">
              <h3 className="text-sm font-medium italic text-zinc-500">Traditional</h3>
              <ul className="mt-6 space-y-3 text-sm text-zinc-300">
                {TRADITIONAL_STEPS.map((step, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span>{step.label}</span>
                    <span className="shrink-0 text-zinc-500">{step.min} min</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex justify-between border-t border-zinc-700 pt-4 font-medium text-zinc-300">
                <span>Total</span>
                <span>60 min</span>
              </div>
              <p className="mt-6 text-sm text-zinc-500">
                If you&apos;re <span className="font-medium text-red-400">non-technical</span>, multiply these{' '}
                <span className="font-medium text-red-400">times by 10</span> — you have to learn each step before doing.
              </p>
            </div>
            {/* Miniclaw column */}
            <div className="animate-fade-in-up animation-delay-200 flex flex-col justify-center p-8 pl-12">
              <h3 className="text-sm font-medium italic text-zinc-500">Miniclaw</h3>
              <p className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                &lt;1 min
              </p>
              <p className="mt-6 text-zinc-400">
                Pick a model, connect Telegram, deploy — done under 1 minute.
              </p>
              <p className="mt-2 text-zinc-500">
                Servers and Nanobot are already set up, waiting to get assigned. Simple, secure and fast connection to your bot.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* What can your assistant do for you? */}
      <section className="border-t border-zinc-800 bg-zinc-950 py-16">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="animate-fade-in-up text-center text-2xl font-semibold text-white sm:text-3xl">
            What can your assistant do for you?
          </h2>
          <p className="animate-fade-in-up animation-delay-100 mt-2 text-center text-zinc-500">
            One assistant, thousands of use cases
          </p>
          <div className="relative mt-10 overflow-hidden">
            {/* Fade edges */}
            <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-20 bg-gradient-to-r from-zinc-950 to-transparent" />
            <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-20 bg-gradient-to-l from-zinc-950 to-transparent" />
            {/* Scrolling marquee */}
            {Array.from({ length: 4 }).map((_, rowIndex) => {
              const scrollRight = rowIndex % 2 === 1;
              const offset = rowIndex * Math.ceil(USE_CASES.length / 4);
              const rowCases = [
                ...USE_CASES.slice(offset, offset + Math.ceil(USE_CASES.length / 4)),
                ...USE_CASES.slice(0, Math.ceil(USE_CASES.length / 4))
              ].slice(0, 10);

              return (
                <div key={rowIndex} className="mb-4 overflow-hidden last:mb-0">
                  <div className={`flex w-max gap-3 ${scrollRight ? 'animate-scroll-right' : 'animate-scroll-left'}`}>
                    {[0, 1].map((copy) => (
                      <div key={copy} className="flex w-max gap-3">
                        {rowCases.map((label, i) => (
                          <div
                            key={`${copy}-${i}`}
                            className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800/30 px-4 py-2.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-800/50"
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="animate-fade-in-up animation-delay-300 mt-8 text-center text-sm italic text-zinc-500">
            PS. You can add as many use cases as you want via natural language
          </p>
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-zinc-800 bg-zinc-900/50 py-12">
        <div className="mx-auto max-w-3xl px-4 text-center">
          <p className="text-zinc-400">
            Set up in under a minute. Cancel anytime.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 bg-zinc-950 py-8">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-4 px-4 text-sm text-zinc-500 sm:flex-row">
          <span>MiniClaw-CC</span>
          <div className="flex flex-wrap justify-center gap-6">
            <Link to="/dashboard" className="hover:text-white">Dashboard</Link>
            <Link to="/faq" className="hover:text-white">FAQ</Link>
            <a href="mailto:support@miniclaw.xyz" className="hover:text-white">Contact Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

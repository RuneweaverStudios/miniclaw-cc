import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckIcon, CopyIcon, TerminalIcon, PowerIcon } from 'lucide-react';

interface DropletAllocation {
  dropletId: number;
  name: string;
  ipAddress: string;
  status: 'allocating' | 'activating' | 'ready' | 'error';
  framework: 'nanobot' | 'openclaw';
  model: string;
  channel: string;
  sshCommand?: string;
  telegramBotToken?: string;
  telegramChatId?: string;
  botInfo?: {
    id: number;
    username?: string;
    firstName: string;
    isBot: boolean;
  };
  directLink?: string;
  startMessageSent?: boolean;
}

export function DeployWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [allocation, setAllocation] = useState<DropletAllocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Telegram configuration states - must be at top level to avoid hooks error
  const [botToken, setBotToken] = useState('');
  const [configuring, setConfiguring] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [configError, setConfigError] = useState('');
  const [progressLogs, setProgressLogs] = useState<Array<{ message: string; type: 'info' | 'success' | 'error' | 'warning'; timestamp: string }>>([]);

  // Get wizard preferences from localStorage
  const framework = localStorage.getItem('wizard_framework') as 'nanobot' | 'openclaw' || 'nanobot';
  const model = localStorage.getItem('wizard_model') || 'minimax/minimax-m2.5';
  const channel = localStorage.getItem('wizard_channel') || 'telegram';

  const token = localStorage.getItem('auth_token');
  if (!token) {
    navigate('/');
    return null;
  }

  // Check if server was already allocated during checkout
  useEffect(() => {
    const checkForAllocatedServer = async () => {
      // First check localStorage (from checkout success)
      const deployedServer = localStorage.getItem('deployed_server');
      if (deployedServer) {
        try {
          const server = JSON.parse(deployedServer);
          console.log('[DeployWizard] Found deployed server in localStorage:', server);
          console.log('[DeployWizard] Server dropletId:', server.dropletId);
          console.log('[DeployWizard] Server ipAddress:', server.ipAddress);
          console.log('[DeployWizard] Server framework:', server.framework, 'stack:', server.stack);
          // Set up the allocation with the deployed server
          const allocationData = {
            dropletId: server.dropletId,
            name: server.dropletName || server.name,
            ipAddress: server.ipAddress,
            status: 'ready' as const,
            framework: server.framework || server.stack,
            model: server.model || localStorage.getItem('wizard_model') || 'minimax/minimax-m2.5',
            channel: server.channel || localStorage.getItem('wizard_channel') || 'telegram',
          };
          console.log('[DeployWizard] Setting allocation:', allocationData);
          setAllocation(allocationData);
          // Skip directly to Telegram pairing step (step 4)
          console.log('[DeployWizard] Setting step to 4 (Telegram pairing)');
          setStep(4);
          // Clear the temp storage so we don't re-use it on revisit
          localStorage.removeItem('deployed_server');
          return;
        } catch (error) {
          console.error('Failed to parse deployed server:', error);
        }
      }

      // Fallback: Check API for existing allocations
      try {
        const response = await fetch('/api/servers', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.servers && data.servers.length > 0) {
            const server = data.servers[0];
            console.log('[DeployWizard] Found existing server from API:', server);
            setAllocation({
              dropletId: server.dropletId,
              name: server.dropletName || server.name,
              ipAddress: server.ipAddress,
              status: 'ready',
              framework: server.stack,
              model: localStorage.getItem('wizard_model') || 'minimax/minimax-m2.5',
              channel: localStorage.getItem('wizard_channel') || 'telegram',
            });
            setStep(4);
          }
        }
      } catch (error) {
        console.error('Failed to fetch existing servers:', error);
      }
    };

    checkForAllocatedServer();
  }, [token]);

  const handleAllocateDroplet = async () => {
    setLoading(true);
    setError('');
    setStep(2);

    try {
      const response = await fetch('/api/servers/allocate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          framework,
          model,
          channel,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to allocate droplet');
      }

      const data = await response.json();
      setAllocation(data);

      // Pre-installed droplets should be ready immediately or in "activating" state
      if (data.status === 'ready') {
        setStep(4); // Skip to Telegram setup
      } else {
        setStep(3); // Show activation progress
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to allocate droplet');
      setStep(1);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!allocation) return;

    try {
      const response = await fetch(`/api/servers/${allocation.dropletId}/status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAllocation({ ...allocation, ...data });

        if (data.status === 'ready') {
          setStep(4);
        }
      }
    } catch (err) {
      console.error('Failed to check status:', err);
    }
  };

  // Poll for status when activating
  useEffect(() => {
    if (step === 3 && allocation?.status === 'activating') {
      const interval = setInterval(handleCheckStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [step, allocation]);

  // Reset progress logs when starting new configuration
  useEffect(() => {
    if (configuring) {
      setProgressLogs([{ message: 'Initializing configuration...', type: 'info', timestamp: new Date().toISOString() }]);
    }
  }, [configuring]);

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConfigureTelegram = async () => {
    if (!botToken.trim()) {
      setConfigError('Please enter your bot token');
      return;
    }

    setConfiguring(true);
    setConfigError('');
    setProgressLogs([{ message: 'Starting configuration...', type: 'info', timestamp: new Date().toISOString() }]);

    try {
      const response = await fetch(
        `/api/servers/${allocation!.dropletId}/configure-telegram/stream?token=${encodeURIComponent(botToken)}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to start configuration stream');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Read SSE stream
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.message) {
                setProgressLogs(prev => [...prev, {
                  message: data.message,
                  type: data.type || 'info',
                  timestamp: data.timestamp || new Date().toISOString()
                }]);
              }

              if (data.error) {
                setConfigError(data.error.message || 'Configuration failed');
                setConfiguring(false);
                return;
              }

              if (data.success) {
                setAllocation({ ...allocation!, telegramBotToken: botToken, ...data });
                setTelegramConfigured(true);
                setConfiguring(false);
              }
            } catch (e) {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to configure Telegram bot');
      setProgressLogs(prev => [...prev, {
        message: err instanceof Error ? err.message : 'Configuration failed',
        type: 'error',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setConfiguring(false);
    }
  };

  const handleComplete = () => {
    setStep(5);
  };

  // Step 1: Overview
  if (step === 1) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-8 shadow-xl">
            <h1 className="text-2xl font-bold text-white">Deploy Your AI Assistant</h1>
            <p className="mt-2 text-zinc-400">
              Your {framework === 'nanobot' ? 'Nanobot' : 'OpenClaw'} instance with {model} will be connected to Telegram.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                  1
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Allocate Pre-installed Droplet</h3>
                  <p className="text-sm text-zinc-400">A pre-configured VPS with {framework} will be assigned from standby pool</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
                  2
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Activate Instance</h3>
                  <p className="text-sm text-zinc-400">Droplet powers on and starts the {framework} gateway</p>
                </div>
              </div>

              <div className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-xs font-bold text-white">
                  3
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-white">Connect Telegram</h3>
                  <p className="text-sm text-zinc-400">Link your bot via BotFather token</p>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-300">
                {error}
              </div>
            )}

            <button
              onClick={handleAllocateDroplet}
              disabled={loading}
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-600 bg-white py-3.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-800" />
                  Allocating droplet...
                </>
              ) : (
                <>
                  <TerminalIcon className="h-5 w-5" />
                  Start Deployment
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Loading
  if (step === 2) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-8 shadow-xl text-center">
            <div className="mx-auto h-16 w-16 animate-spin rounded-full border-4 border-zinc-700 border-t-sky-500" />
            <h2 className="mt-6 text-xl font-bold text-white">Allocating Pre-installed Droplet</h2>
            <p className="mt-2 text-zinc-400">
              Finding a {framework} instance from our standby pool...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Activating (polling)
  if (step === 3 && allocation) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-8 shadow-xl">
            <div className="flex items-center gap-4">
              <PowerIcon className="h-12 w-12 text-sky-400" />
              <div className="flex-1">
                <h2 className="text-lg font-bold text-white">Activating Your Instance</h2>
                <p className="text-sm text-zinc-400">
                  Powering on {framework} gateway with {model}...
                </p>
              </div>
            </div>

            <div className="mt-6 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-zinc-500">Droplet ID:</span>
                  <p className="font-mono text-white">{allocation.dropletId}</p>
                </div>
                <div>
                  <span className="text-zinc-500">IP Address:</span>
                  <p className="font-mono text-white">{allocation.ipAddress}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Framework:</span>
                  <p className="text-white capitalize">{allocation.framework}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Model:</span>
                  <p className="text-white">{allocation.model}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
              <p className="text-sm text-emerald-300">
                ✓ Pre-installed {framework} allocated from pool
              </p>
              <p className="mt-1 text-sm text-emerald-300">
                ✓ Instance ready and waiting!
              </p>
            </div>

            <button
              onClick={() => setStep(4)}
              className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-zinc-600 bg-white py-3.5 text-sm font-medium text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              <CheckIcon className="h-5 w-5" />
              Continue to Telegram Setup
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 4: Telegram Setup
  if (step === 4 && allocation) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-2xl border border-zinc-700/80 bg-zinc-900/80 p-8 shadow-xl">
            <div className="flex items-center gap-3">
              {telegramConfigured ? (
                <CheckIcon className="h-8 w-8 text-emerald-400" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <span className="text-sky-400 text-sm font-bold">3</span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-white">
                  {telegramConfigured ? 'Telegram Connected!' : 'Connect Your Bot'}
                </h1>
                <p className="text-sm text-zinc-400">
                  {telegramConfigured ? 'Your bot is ready to use' : 'Enter your bot token from BotFather'}
                </p>
              </div>
            </div>

            <div className="mt-8 space-y-6">
              {!telegramConfigured && (
                <>
                  <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                    <h3 className="font-medium text-white">Create Your Bot</h3>
                    <ol className="mt-3 space-y-2 text-sm text-zinc-300">
                      <li className="flex gap-2">
                        <span className="text-sky-400">1.</span>
                        <span>Open Telegram and search for <span className="font-mono text-sky-300">@BotFather</span></span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-sky-400">2.</span>
                        <span>Send <span className="font-mono text-sky-300">/newbot</span> and follow the prompts</span>
                      </li>
                      <li className="flex gap-2">
                        <span className="text-sky-400">3.</span>
                        <span>Copy the bot token (looks like <span className="font-mono text-sky-300">123456:ABC-DEF...</span>)</span>
                      </li>
                    </ol>
                  </div>

                  <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                    <h3 className="font-medium text-white">Enter Bot Token</h3>
                    <p className="mt-2 text-sm text-zinc-300">
                      Paste your bot token to automatically configure:
                    </p>
                    <input
                      type="text"
                      value={botToken}
                      onChange={(e) => setBotToken(e.target.value)}
                      placeholder="123456:ABC-DEF1234..."
                      className="mt-3 w-full rounded-lg border border-zinc-600 bg-zinc-950 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                    />
                    {configError && (
                      <p className="mt-2 text-sm text-red-400">{configError}</p>
                    )}
                  </div>

                  <button
                    onClick={handleConfigureTelegram}
                    disabled={configuring || !botToken.trim()}
                    className="mt-4 flex w-full items-center justify-center gap-3 rounded-xl border border-sky-600 bg-sky-600 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-sky-700 disabled:opacity-50"
                  >
                    {configuring ? (
                      <>
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-400 border-t-white" />
                        Configuring...
                      </>
                    ) : (
                      <>
                        <CheckIcon className="h-5 w-5" />
                        Configure Bot
                      </>
                    )}
                  </button>

                  {/* Progress Log */}
                  {configuring && progressLogs.length > 0 && (
                    <div className="mt-6 rounded-lg border border-zinc-700/50 bg-zinc-950 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-medium text-white flex items-center gap-2">
                          <TerminalIcon className="h-4 w-4 text-sky-400" />
                          Configuration Progress
                        </h3>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                          <span className="text-xs text-zinc-500">Live</span>
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-1.5 font-mono text-xs">
                        {progressLogs.map((log, index) => (
                          <div
                            key={index}
                            className={`flex items-start gap-2 ${
                              log.type === 'error' ? 'text-red-400' :
                              log.type === 'success' ? 'text-emerald-400' :
                              log.type === 'warning' ? 'text-amber-400' :
                              'text-zinc-300'
                            }`}
                          >
                            <span className="text-zinc-600 shrink-0">{index + 1}.</span>
                            <span className="break-all">{log.message}</span>
                          </div>
                        ))}
                        {configuring && (
                          <div className="flex items-center gap-2 text-sky-400 animate-pulse">
                            <span className="text-zinc-600">...</span>
                            <span>Processing...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {telegramConfigured && (
                <div className="rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-6">
                  <div className="flex items-start gap-4">
                    <CheckIcon className="h-6 w-6 text-emerald-400 shrink-0 mt-1" />
                    <div className="flex-1">
                      <h3 className="font-medium text-white">Bot Successfully Configured!</h3>
                      <p className="mt-2 text-sm text-zinc-300">
                        Your {framework} instance is connected to Telegram and ready.
                        {allocation.startMessageSent && (
                          <span className="text-emerald-400"> ✓ /start command sent</span>
                        )}
                      </p>
                      {allocation.botInfo && (
                        <div className="mt-4 rounded-lg bg-zinc-950 p-3">
                          <p className="text-xs text-zinc-500 mb-1">Bot Details:</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <span className="text-zinc-500">Name:</span>
                            <span className="text-white">{allocation.botInfo.firstName}</span>
                            {allocation.botInfo.username && (
                              <>
                                <span className="text-zinc-500">Username:</span>
                                <span className="font-mono text-sky-300">@{allocation.botInfo.username}</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      <div className="mt-4">
                        <a
                          href={allocation.directLink || `https://t.me/me`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-lg border border-sky-600 bg-sky-600 px-6 py-3 text-sm font-medium text-white hover:bg-sky-700"
                        >
                          Open Your Bot in Telegram
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-4">
                <h3 className="font-medium text-white">SSH Access</h3>
                <p className="mt-2 text-sm text-zinc-300">
                  Connect directly to your instance:
                </p>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-zinc-950 p-3">
                  <code className="text-sm text-sky-300">
                    ssh root@{allocation.ipAddress}
                  </code>
                  <button
                    onClick={() => handleCopyToClipboard(`ssh root@${allocation.ipAddress}`)}
                    className="ml-2 rounded p-1 hover:bg-zinc-800"
                  >
                    <CopyIcon className="h-4 w-4 text-zinc-400" />
                  </button>
                </div>
              </div>
            </div>

            {telegramConfigured && (
              <button
                onClick={handleComplete}
                className="mt-8 flex w-full items-center justify-center gap-3 rounded-xl border border-emerald-600 bg-emerald-600 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
              >
                <CheckIcon className="h-5 w-5" />
                Complete Setup
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Complete
  if (step === 5) {
    return (
      <div className="min-h-screen bg-zinc-950 px-4 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20">
            <CheckIcon className="h-10 w-10 text-emerald-400" />
          </div>
          <h1 className="mt-6 text-3xl font-bold text-white">You're All Set!</h1>
          <p className="mt-4 text-lg text-zinc-400">
            Your {framework} instance is running and connected to Telegram.
          </p>

          <div className="mt-8 rounded-xl border border-zinc-700/50 bg-zinc-900/50 p-6 text-left">
            <h3 className="font-medium text-white">Quick Reference</h3>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Instance IP:</span>
                <span className="font-mono text-sky-300">{allocation?.ipAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Framework:</span>
                <span className="text-white capitalize">{allocation?.framework}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Model:</span>
                <span className="text-white">{allocation?.model}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <a
              href="https://telegram.me/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 rounded-xl border border-sky-600 bg-sky-600 px-8 py-3.5 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
            >
              Open Telegram
            </a>
          </div>

          <p className="mt-6 text-sm text-zinc-500">
            Need help? <a href="mailto:support@miniclaw.xyz" className="text-sky-400 hover:underline">Contact Support</a>
          </p>
        </div>
      </div>
    );
  }

  return null;
}

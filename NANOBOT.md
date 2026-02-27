# nanobot: Ultra-Lightweight Personal AI Assistant

Source: https://github.com/HKUDS/nanobot

## Overview

**nanobot** is an **ultra-lightweight** personal AI assistant inspired by [OpenClaw](https://github.com/openclaw/openclaw)

- Delivers core agent functionality in just **~4,000** lines of code — **99% smaller** than Clawdbot's 430k+ lines.
- Real-time line count: **3,932 lines** (run `bash core_agent_lines.sh` to verify anytime)

## Key Features

- **Ultra-Lightweight**: Just ~4,000 lines of core agent code
- **Research-Ready**: Clean, readable code that's easy to understand, modify, and extend
- **Lightning Fast**: Minimal footprint means faster startup, lower resource usage
- **Easy-to-Use**: One-click to deploy and you're ready to go

## Installation

### Install from source (recommended for development)

```bash
git clone https://github.com/HKUDS/nanobot.git
cd nanobot
pip install -e .
```

### Install with uv (stable, fast)

```bash
uv tool install nanobot-ai
```

### Install from PyPI (stable)

```bash
pip install nanobot-ai
```

## Quick Start

### 1. Initialize

```bash
nanobot onboard
```

### 2. Configure (`~/.nanobot/config.json`)

Set your API key (e.g. OpenRouter, recommended for global users):

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-xxx"
    }
  }
}
```

Set your model:

```json
{
  "agents": {
    "defaults": {
      "model": "anthropic/claude-opus-4-5",
      "provider": "openrouter"
    }
  }
}
```

### 3. Chat

```bash
nanobot agent
```

## Chat Apps Configuration

| Channel | What you need |
|---------|---------------|
| **Telegram** | Bot token from @BotFather |
| **Discord** | Bot token + Message Content intent |
| **WhatsApp** | QR code scan |
| **Feishu** | App ID + App Secret |
| **Mochat** | Claw token (auto-setup available) |
| **DingTalk** | App Key + App Secret |
| **Slack** | Bot token + App-Level token |
| **Email** | IMAP/SMTP credentials |
| **QQ** | App ID + App Secret |

### Telegram (Recommended)

**1. Create a bot**
- Open Telegram, search `@BotFather`
- Send `/newbot`, follow prompts
- Copy the token

**2. Configure**

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"]
    }
  }
}
```

**3. Run**

```bash
nanobot gateway
```

### Discord

**1. Create a bot**
- Go to https://discord.com/developers/applications
- Create an application → Bot → Add Bot
- Copy the bot token

**2. Enable intents**
- Enable **MESSAGE CONTENT INTENT**
- Enable **SERVER MEMBERS INTENT** (optional)

**3. Configure**

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "token": "YOUR_BOT_TOKEN",
      "allowFrom": ["YOUR_USER_ID"]
    }
  }
}
```

### WhatsApp

Requires **Node.js ≥18**.

**1. Link device**

```bash
nanobot channels login
# Scan QR with WhatsApp → Settings → Linked Devices
```

**2. Configure**

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "allowFrom": ["+1234567890"]
    }
  }
}
```

**3. Run** (two terminals)

```bash
# Terminal 1
nanobot channels login

# Terminal 2
nanobot gateway
```

### Slack

Uses **Socket Mode** — no public URL required.

**1. Create a Slack app**
- Go to [Slack API](https://api.slack.com/apps) → **Create New App**
- Configure Socket Mode, OAuth scopes, and events
- Install to get tokens

**2. Configure**

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "botToken": "xoxb-...",
      "appToken": "xapp-...",
      "groupPolicy": "mention"
    }
  }
}
```

**3. Run**

```bash
nanobot gateway
```

## Providers

| Provider | Purpose | Get API Key |
|----------|---------|-------------|
| `custom` | Any OpenAI-compatible endpoint | — |
| `openrouter` | LLM (recommended) | [openrouter.ai](https://openrouter.ai) |
| `anthropic` | LLM (Claude direct) | [console.anthropic.com](https://console.anthropic.com) |
| `openai` | LLM (GPT direct) | [platform.openai.com](https://platform.openai.com) |
| `deepseek` | LLM (DeepSeek direct) | [platform.deepseek.com](https://platform.deepseek.com) |
| `groq` | LLM + Voice transcription | [console.groq.com](https://console.groq.com) |
| `gemini` | LLM (Gemini direct) | [aistudio.google.com](https://aistudio.google.com) |
| `minimax` | LLM (MiniMax direct) | [platform.minimaxi.com](https://platform.minimaxi.com) |
| `siliconflow` | LLM (SiliconFlow) | [siliconflow.cn](https://siliconflow.cn) |
| `volcengine` | LLM (VolcEngine) | [volcengine.com](https://www.volcengine.com) |
| `dashscope` | LLM (Qwen) | [dashscope.console.aliyun.com](https://dashscope.console.aliyun.com) |
| `moonshot` | LLM (Moonshot/Kimi) | [platform.moonshot.cn](https://platform.moonshot.cn) |
| `zhipu` | LLM (Zhipu GLM) | [open.bigmodel.cn](https://open.bigmodel.cn) |
| `vllm` | LLM (local) | — |
| `openai_codex` | LLM (Codex, OAuth) | `nanobot provider login openai-codex` |
| `github_copilot` | LLM (GitHub Copilot) | `nanobot provider login github-copilot` |

## MCP (Model Context Protocol)

Add MCP servers to your `config.json`:

```json
{
  "tools": {
    "mcpServers": {
      "filesystem": {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
      },
      "my-remote-mcp": {
        "url": "https://example.com/mcp/",
        "headers": {
          "Authorization": "Bearer xxxxx"
        }
      }
    }
  }
}
```

## CLI Reference

| Command | Description |
|---------|-------------|
| `nanobot onboard` | Initialize config & workspace |
| `nanobot agent -m "..."` | Chat with the agent |
| `nanobot agent` | Interactive chat mode |
| `nanobot gateway` | Start the gateway |
| `nanobot status` | Show status |
| `nanobot provider login` | OAuth login for providers |
| `nanobot channels login` | Link WhatsApp (scan QR) |
| `nanobot cron add/list/remove` | Scheduled tasks |

## Docker

### Docker Compose

```bash
docker compose run --rm nanobot-cli onboard   # first-time setup
vim ~/.nanobot/config.json                     # add API keys
docker compose up -d nanobot-gateway           # start gateway
```

### Docker

```bash
# Build the image
docker build -t nanobot .

# Initialize config
docker run -v ~/.nanobot:/root/.nanobot --rm nanobot onboard

# Run gateway
docker run -v ~/.nanobot:/root/.nanobot -p 18790:18790 nanobot gateway
```

## Linux Service (systemd)

**1. Create service file** at `~/.config/systemd/user/nanobot-gateway.service`:

```ini
[Unit]
Description=Nanobot Gateway
After=network.target

[Service]
Type=simple
ExecStart=%h/.local/bin/nanobot gateway
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
```

**2. Enable and start:**

```bash
systemctl --user daemon-reload
systemctl --user enable --now nanobot-gateway
```

## Project Structure

```
nanobot/
├── agent/          # Core agent logic
│   ├── loop.py     # Agent loop (LLM ↔ tool execution)
│   ├── context.py  # Prompt builder
│   ├── memory.py   # Persistent memory
│   ├── skills.py   # Skills loader
│   ├── subagent.py # Background task execution
│   └── tools/      # Built-in tools
├── skills/         # Bundled skills
├── channels/       # Chat channel integrations
├── bus/            # Message routing
├── cron/           # Scheduled tasks
├── heartbeat/      # Proactive wake-up
├── providers/      # LLM providers
├── session/        # Conversation sessions
├── config/         # Configuration
└── cli/            # Commands
```

## Agent Social Network

nanobot can link to the agent social network:

| Platform | How to Join |
|----------|-------------|
| **Moltbook** | `Read https://moltbook.com/skill.md and follow the instructions` |
| **ClawdChat** | `Read https://clawdchat.ai/skill.md and follow the instructions` |

## Security

| Option | Default | Description |
|--------|---------|-------------|
| `tools.restrictToWorkspace` | `false` | Restrict all agent tools to workspace directory |
| `tools.exec.pathAppend` | `""` | Extra directories to append to PATH |
| `channels.*.allowFrom` | `[]` | Whitelist of user IDs (empty = allow all) |

## MiniClaw-CC Automated Provisioning

### Overview

For MiniClaw-CC's automated provisioning flow, Nanobot is installed on fresh droplets and configured with:
1. Model provider (OpenRouter, Anthropic, etc.)
2. Telegram bot token
3. Gateway started as systemd service

### Critical Version Information

**IMPORTANT**: Use PyPI version for production (no oauth-cli-kit dependency):

- **PyPI stable version**: `0.1.3.post7` - Does NOT require `oauth-cli-kit` (latest tested)
- **GitHub latest version**: `0.1.4.post2` - Requires `oauth-cli-kit` (optional OAuth feature)

For MiniClaw-CC, use the PyPI version to avoid dependency issues:

```bash
pip install nanobot-ai==0.1.3.post7 --break-system-packages --ignore-installed typing_extensions
```

Note: The `--ignore-installed typing_extensions` flag is required to avoid conflicts with the Ubuntu package.

The `oauth-cli-kit` package is only needed for OpenAI Codex OAuth login (advanced feature).

### Automated Installation Script

```bash
#!/bin/bash
# install-nanobot.sh - Provision Nanobot on fresh Ubuntu droplet

set -e

echo "[Nanobot] Installing Nanobot..."

# Install Python 3.11+
apt-get update
apt-get install -y python3.11 python3.11-venv python3-pip

# Install Nanobot from PyPI (stable version)
pip3 install nanobot-ai==0.1.3.post7 --break-system-packages --ignore-installed typing_extensions

# Create nanobot user for security
useradd -m -s /bin/bash nanobot || true

# Initialize config (as nanobot user)
sudo -u nanobot nanobot onboard

echo "[Nanobot] Installation complete"
```

### Configuration Schema

Nanobot's configuration is stored in `~/.nanobot/config.json`:

```json
{
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-xxx"
    },
    "anthropic": {
      "apiKey": "sk-ant-xxx"
    }
  },
  "agents": {
    "defaults": {
      "model": "anthropic/claude-opus-4-5",
      "provider": "openrouter",
      "maxTokens": 8192,
      "temperature": 0.1
    }
  },
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "BOT_TOKEN_FROM_BOTFATHER",
      "allowFrom": []
    }
  },
  "tools": {
    "restrictToWorkspace": false,
    "exec": {
      "pathAppend": ""
    }
  },
  "workspace": "~/.nanobot/workspace"
}
```

### Model Provider Configuration

Nanobot uses LiteLLM for provider abstraction. Model format: `provider/model`

| Model Format | Provider | API Key Location |
|-------------|----------|------------------|
| `anthropic/claude-opus-4-5` | Anthropic | `providers.anthropic.apiKey` |
| `openai/gpt-4` | OpenAI | `providers.openai.apiKey` |
| `openrouter/anthropic/claude-opus-4-5` | OpenRouter | `providers.openrouter.apiKey` |
| `deepseek/deepseek-chat` | DeepSeek | `providers.deepseek.apiKey` |

**Provider Detection**:
1. Explicit prefix in model name (e.g., `openrouter/...`)
2. API key format (e.g., `sk-or-` → OpenRouter)
3. Fallback to `agents.defaults.provider`

### Telegram Channel Configuration

**Configuration fields**:
```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "token": "123456:ABC-DEF1234ghikl...",
      "allowFrom": [],           // Empty = allow all users
      "proxy": null,             // Optional SOCKS proxy
      "reply_to_message": false  // Reply to user messages
    }
  }
}
```

**Telegram Implementation**:
- Library: `python-telegram-bot` (long polling, no webhook needed)
- Media support: Photos, voice, documents downloaded to `~/.nanobot/media/`
- Built-in commands: `/start`, `/new`, `/stop`, `/help`
- Voice transcription: Requires Groq API key configured

### Gateway Startup

**Command**:
```bash
nanobot gateway
```

**What happens during gateway startup**:
1. Loads config from `~/.nanobot/config.json`
2. Initializes LLM provider with API key
3. Starts enabled channels (Telegram, Discord, etc.)
4. Initializes cron service (scheduled tasks)
5. Initializes heartbeat service (periodic tasks)
6. Starts agent loop (processes messages from channels)

**Gateway architecture**:
```
┌─────────────────────────────────────────────────────┐
│                   nanobot gateway                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐      ┌──────────────┐            │
│  │   Telegram   │      │   Discord    │            │
│  │   Channel    │      │   Channel    │            │
│  └──────┬───────┘      └──────┬───────┘            │
│         │                     │                     │
│         └──────────┬──────────┘                     │
│                    │                                │
│         ┌──────────▼──────────┐                    │
│         │    Message Bus      │                    │
│         └──────────┬──────────┘                    │
│                    │                                │
│         ┌──────────▼──────────┐                    │
│         │    Agent Loop       │                    │
│         │  - LLM calls        │                    │
│         │  - Tool execution   │                    │
│         │  - Memory           │                    │
│         └──────────┬──────────┘                    │
│                    │                                │
│         ┌──────────▼──────────┐                    │
│         │  LLM Provider       │                    │
│         │  (LiteLLM)          │                    │
│         └─────────────────────┘                    │
└─────────────────────────────────────────────────────┘
```

### systemd Service Configuration

**Create service file** at `/etc/systemd/system/nanobot-gateway.service`:

```ini
[Unit]
Description=Nanobot Gateway
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=nanobot
Group=nanobot
WorkingDirectory=/home/nanobot
ExecStart=/usr/local/bin/nanobot gateway
Restart=always
RestartSec=10
Environment="PATH=/usr/local/bin:/usr/bin:/bin"

# Security hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/home/nanobot/.nanobot

[Install]
WantedBy=multi-user.target
```

**Enable and start**:
```bash
systemctl daemon-reload
systemctl enable nanobot-gateway
systemctl start nanobot-gateway
systemctl status nanobot-gateway
```

### Health Check

**Verify Nanobot is running**:

```bash
# Check process
ps aux | grep "nanobot gateway"

# Check gateway port (18790)
netstat -tlnp | grep 18790

# Check logs
journalctl -u nanobot-gateway -f

# Test Telegram bot
curl -s "https://api.telegram.org/bot<BOT_TOKEN>/getMe"
```

**Expected output**:
- Process running: `nanobot gateway` process visible
- Port listening: 18790 open (gateway internal port)
- Logs: Shows "Channels enabled: telegram" or similar
- Telegram: Bot info returned (username, id, etc.)

### Configuration via SSH

For MiniClaw-CC's allocation flow, configure Nanobot via SSH:

```typescript
// Helper function to configure Nanobot with model and Telegram
async function configureNanobot(ssh: SSHClient, botToken: string, model: string): Promise<void> {
  // Parse model to extract provider
  let provider = 'openrouter';
  let modelName = model;

  if (model.includes('/')) {
    const parts = model.split('/');
    provider = parts[0];
    modelName = parts.slice(1).join('/');
  }

  // Read existing config
  let config: any = {};
  try {
    const existing = await ssh.readFile('/root/.nanobot/config.json');
    config = JSON.parse(existing);
  } catch {
    // Create new config
    config = {};
  }

  // Configure provider
  config.providers = config.providers || {};

  // Map provider names
  const providerMap: Record<string, string> = {
    'openrouter': 'openrouter',
    'anthropic': 'anthropic',
    'openai': 'openai',
    'deepseek': 'deepseek',
  };

  const nanobotProvider = providerMap[provider] || 'openrouter';

  // Add API key from environment
  if (nanobotProvider === 'openrouter') {
    config.providers.openrouter = {
      apiKey: process.env.OPENROUTER_API_KEY || ''
    };
  } else if (nanobotProvider === 'anthropic') {
    config.providers.anthropic = {
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    };
  }

  // Configure default agent
  config.agents = config.agents || {};
  config.agents.defaults = {
    model: modelName,
    provider: nanobotProvider
  };

  // Configure Telegram
  config.channels = config.channels || {};
  config.channels.telegram = {
    enabled: true,
    token: botToken,
    allowFrom: []
  };

  // Write config
  await ssh.mkdir('/root/.nanobot', true);
  await ssh.writeFile('/root/.nanobot/config.json', JSON.stringify(config, null, 2));

  // Restart gateway
  await ssh.executeCommand('pkill -f "nanobot gateway" || true');
  await ssh.executeCommand('sleep 2');
  await ssh.executeCommand('nohup nanobot gateway > /tmp/nanobot-gateway.log 2>&1 &');
  await ssh.executeCommand('sleep 3');

  // Verify
  const ps = await ssh.executeCommand('ps aux | grep "[n]anobot gateway"');
  if (!ps.trim()) {
    throw new Error('Gateway not running');
  }
}
```

### Troubleshooting

**Issue**: `oauth-cli-kit not found`

**Solution**: Install from PyPI (not GitHub source):
```bash
pip install nanobot-ai==0.1.3.post7 --break-system-packages --ignore-installed typing_extensions
```

**Issue**: Gateway won't start

**Solution**: Check configuration file:
```bash
nanobot status  # Shows config and model
cat ~/.nanobot/config.json  # Verify JSON is valid
```

**Issue**: Telegram bot not responding

**Solution**: Check logs and bot token:
```bash
journalctl -u nanobot-gateway -n 50
curl -s "https://api.telegram.org/bot<TOKEN>/getMe"
```

**Issue**: Model API errors

**Solution**: Verify API key is set:
```bash
cat ~/.nanobot/config.json | grep apiKey
```

### Memory Requirements

| Droplet Size | Recommended |
|--------------|-------------|
| 512 MB | Not recommended |
| 1 GB | Minimum (Python + LiteLLM) |
| 2 GB | Recommended |

Nanobot's Python footprint is lighter than OpenClaw's Node.js, making it suitable for 1GB droplets.

### Provisioning Checklist

- [ ] Python 3.11+ installed
- [ ] Nanobot installed via PyPI (`pip install nanobot-ai`)
- [ ] Config initialized (`nanobot onboard`)
- [ ] Provider API key configured
- [ ] Model configured in `agents.defaults`
- [ ] Telegram bot token configured
- [ ] Gateway started and verified
- [ ] systemd service configured
- [ ] Health check passing
- [ ] Bot responds to `/start` command

## News

- **2026-02-24** — v0.1.4.post2 — reliability-focused release with redesigned heartbeat
- **2026-02-17** — v0.1.4 — MCP support, progress streaming, new providers
- **2026-02-14** — MCP support
- **2026-02-13** — v0.1.3.post7 — security hardening

# Chat Channels - OpenClaw

Source: https://docs.openclaw.ai/channels

OpenClaw can talk to you on any chat app you already use. Each channel connects via the Gateway.
Text is supported everywhere; media and reactions vary by channel.

## Supported channels

- **WhatsApp** — Most popular; uses Baileys and requires QR pairing.
- **Telegram** — Bot API via grammY; supports groups.
- **Discord** — Discord Bot API + Gateway; supports servers, channels, and DMs.
- **IRC** — Classic IRC servers; channels + DMs with pairing/allowlist controls.
- **Slack** — Bolt SDK; workspace apps.
- **Feishu** — Feishu/Lark bot via WebSocket (plugin, installed separately).
- **Google Chat** — Google Chat API app via HTTP webhook.
- **Mattermost** — Bot API + WebSocket; channels, groups, DMs (plugin, installed separately).
- **Signal** — signal-cli; privacy-focused.
- **BlueBubbles** — **Recommended for iMessage**; uses the BlueBubbles macOS server REST API with full feature support (edit, unsend, effects, reactions, group management — edit currently broken on macOS 26 Tahoe).
- **iMessage (legacy)** — Legacy macOS integration via imsg CLI (deprecated, use BlueBubbles for new setups).
- **Microsoft Teams** — Bot Framework; enterprise support (plugin, installed separately).
- **Synology Chat** — Synology NAS Chat via outgoing+incoming webhooks (plugin, installed separately).
- **LINE** — LINE Messaging API bot (plugin, installed separately).
- **Nextcloud Talk** — Self-hosted chat via Nextcloud Talk (plugin, installed separately).
- **Matrix** — Matrix protocol (plugin, installed separately).
- **Nostr** — Decentralized DMs via NIP-04 (plugin, installed separately).
- **Tlon** — Urbit-based messenger (plugin, installed separately).
- **Twitch** — Twitch chat via IRC connection (plugin, installed separately).
- **Zalo** — Zalo Bot API; Vietnam's popular messenger (plugin, installed separately).
- **Zalo Personal** — Zalo personal account via QR login (plugin, installed separately).
- **WebChat** — Gateway WebChat UI over WebSocket.

## Notes

- Channels can run simultaneously; configure multiple and OpenClaw will route per chat.
- Fastest setup is usually **Telegram** (simple bot token). WhatsApp requires QR pairing and
  stores more state on disk.
- Group behavior varies by channel; see Groups.
- DM pairing and allowlists are enforced for safety; see Security.
- Troubleshooting: Channel troubleshooting.
- Model providers are documented separately; see Model Providers.

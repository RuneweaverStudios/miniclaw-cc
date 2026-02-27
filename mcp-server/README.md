# MiniClaw-CC Code Mode MCP Server

## What is Code Mode?

Code Mode is a pattern for MCP servers that dramatically reduces token usage. Instead of exposing thousands of tools (one per API endpoint), Code Mode exposes just **2 tools**:

- `search(code)` - Search through the API OpenAPI spec
- `execute(code)` - Execute JavaScript code against the API

**Result**: ~1,000 tokens regardless of API size (vs. 1.17M tokens for traditional MCP)

## How It Works

### Traditional MCP (❌ Bad)
```
2500+ endpoints → 2500+ tools → 1.17M tokens → context overflow
```

### Code Mode MCP (✅ Good)
```
OpenAPI spec + 2 tools → 1,000 tokens → entire API accessible
```

### Example Usage

#### Step 1: Search for endpoints

Ask the agent to list all authentication endpoints:

```javascript
async () => {
  const results = [];
  for (const [path, methods] of Object.entries(spec.paths)) {
    if (path.includes('/auth')) {
      for (const [method, op] of Object.entries(methods)) {
        results.push({
          method: method.toUpperCase(),
          path,
          summary: op.summary,
          tags: op.tags
        });
      }
    }
  }
  return results;
}
```

**Returns**:
```json
[
  { "method": "GET", "path": "/api/auth", "summary": "Get current user", "tags": ["Authentication"] },
  { "method": "POST", "path": "/api/auth/signin", "summary": "Sign in user", "tags": ["Authentication"] },
  { "method": "POST", "path": "/api/auth/signup", "summary": "Sign up new user", "tags": ["Authentication"] }
]
```

#### Step 2: Execute API calls

Sign up a new user:

```javascript
async () => {
  const response = await miniclaw.request({
    method: 'POST',
    path: '/api/auth/signup',
    body: {
      email: 'user@example.com',
      password: 'securepassword123',
      name: 'Test User',
      stack: 'openclaw'
    }
  });

  if (response.ok) {
    return {
      success: true,
      user: response.data.user,
      token: response.data.token
    };
  } else {
    return {
      success: false,
      error: response.data
    };
  }
}
```

Chain multiple operations:

```javascript
async () => {
  // Get pool status
  const pool = await miniclaw.request({
    method: 'GET',
    path: '/api/pool'
  });

  // Provision a server if pool has capacity
  if (pool.data.data.available > 0) {
    const server = await miniclaw.request({
      method: 'POST',
      path: '/api/servers/provision',
      body: {
        plan: 'free',
        region: 'nyc3',
        stack: 'openclaw'
      }
    });

    return {
      poolStatus: pool.data,
      provisionedServer: server.data
    };
  }

  return { message: 'No available servers in pool' };
}
```

## Installation

### 1. Install dependencies

```bash
cd mcp-server
pnpm install
```

### 2. Configure environment variables

Create `.env`:

```bash
MINICLAW_API_URL=http://localhost:4000
MINICLAW_API_TOKEN=your-jwt-token-here
```

### 3. Add to MCP client configuration

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "miniclaw": {
      "command": "node",
      "args": ["/path/to/miniclaw-cc/mcp-server/src/index.js"],
      "env": {
        "MINICLAW_API_URL": "http://localhost:4000",
        "MINICLAW_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

**Continue.dev** (`~/.continue/config.json`):

```json
{
  "mcpServers": [
    {
      "name": "miniclaw",
      "command": "node",
      "args": ["/path/to/miniclaw-cc/mcp-server/src/index.js"],
      "env": {
        "MINICLAW_API_URL": "http://localhost:4000"
      }
    }
  ]
}
```

## Available in Sandbox

When executing code, these APIs are available:

### `spec` object
The full OpenAPI specification with all `$refs` pre-resolved.

### `miniclaw.request(options)`
Make authenticated HTTP requests to the MiniClaw API.

```typescript
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;  // e.g., '/api/servers'
  headers?: Record<string, string>;
  body?: any;
}

interface Response {
  status: number;
  statusText: string;
  ok: boolean;
  data: any;
}
```

### `miniclaw.uuid()`
Generate a random UUID.

### `console.log()`, `console.error()`, etc.
Output returned with the result.

## Token Usage Comparison

| Approach | Token Cost | Tools |
|----------|-----------|-------|
| Traditional MCP | 1,170,000 | 2,500+ |
| **Code Mode** | **~1,000** | **2** |

**Savings**: 99.9% token reduction

## Security

- Code runs in Node.js VM sandbox (isolated from main process)
- 30-second execution timeout
- No file system access
- No environment variable leakage
- Auth tokens managed server-side
- Outbound requests controlled via `miniclaw.request()` only

## Examples

### Check pool health
```javascript
async () => {
  const health = await miniclaw.request({
    method: 'GET',
    path: '/health'
  });

  return {
    status: health.data.status,
    redis: health.data.services.redis,
    uptime: health.data.uptime
  };
}
```

### List my servers
```javascript
async () => {
  const servers = await miniclaw.request({
    method: 'GET',
    path: '/api/servers'
  });

  return servers.data.servers.map(s => ({
    id: s.id,
    hostname: s.hostname,
    stack: s.stack,
    status: s.status
  }));
}
```

### Provision and configure server
```javascript
async () => {
  // Provision from pool
  const server = await miniclaw.request({
    method: 'POST',
    path: '/api/servers/provision',
    body: { plan: 'free', region: 'nyc3', stack: 'openclaw' }
  });

  if (!server.ok) {
    return { error: 'Failed to provision' };
  }

  const serverId = server.data.server.id;

  // Get details
  const details = await miniclaw.request({
    method: 'GET',
    path: `/api/servers/${serverId}`
  });

  return {
    provisioned: server.data,
    details: details.data
  };
}
```

## Development

### Run locally
```bash
pnpm dev
```

### Test with curl
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search","arguments":{"code":"async()=>{return Object.keys(spec.paths).slice(0,5)}"}}}' | node src/index.js
```

## Resources

- [Cloudflare Code Mode Blog Post](https://blog.cloudflare.com/code-mode-mcp/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [OpenAPI Specification](https://swagger.io/specification/)

---

**Result**: Full API access in minimal tokens. 🚀

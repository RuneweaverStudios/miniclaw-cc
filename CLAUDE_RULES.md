# Claude Code Rules for MiniClaw-CC

## Prime Directive: Check Documentation First

Before making ANY changes to code, configuration, or infrastructure:

1. **Read existing docs** - Check for existing documentation in the project
2. **Search codebase** - Use Grep/Glob to understand current implementation
3. **Check official docs** - Use Web Search or MCP web-reader to fetch official documentation
4. **Understand context** - Use Explore agent for broader codebase understanding

## Workflow Checklist

```
┌─────────────────────────────────────────────────────────┐
│  TASK REQUESTED                                         │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Read Documentation  │
        │  - Project README    │
        │  - Official docs     │
        │  - Code comments     │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Search Codebase     │
        │  - Grep for patterns │
        │  - Glob for files    │
        │  - Read related code │
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Plan Changes        │
        │  - Consider impact   │
        │  - Check deps        │
        │  - Document reasoning│
        └──────────┬───────────┘
                   │
                   ▼
        ┌──────────────────────┐
        │  Implement           │
        │  - Make minimal      │
        │    changes           │
        │  - Test              │
        └──────────────────────┘
```

## MCP Tools Available for Documentation

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `mcp__web-reader__webReader` | Fetch web docs as markdown | Reading official documentation |
| `mcp__web-search-prime__webSearchPrime` | Search web for current info | Finding latest docs/examples |
| `mcp__zread__read_file` | Read GitHub files | Checking package source code |
| `mcp__zread__search_doc` | Search GitHub repo docs | Finding specific documentation |
| `Glob` | Find files by pattern | Locating config/docs files |
| `Grep` | Search file contents | Finding usage patterns |

## Examples of "Check Docs First" Mindset

### ❌ Bad: Making assumptions
```bash
# Just installing without checking
pnpm add vite-plugin-checker
```

### ✅ Good: Checking docs first
```bash
# 1. Check Vite docs for recommended type checking
mcp__web-reader__webReader("https://vite.dev/guide/features")

# 2. Search how vite-plugin-checker works
mcp__web-search-prime__webSearchPrime("vite-plugin-checker setup 2026")

# 3. Check existing project config
Read("apps/web/vite.config.ts")

# 4. Then implement with understanding
Edit with proper configuration
```

## Technology-Specific Documentation Sources

### Vite
- Official: https://vite.dev/guide/
- CLI Reference: https://vite.dev/guide/cli
- Config: https://vite.dev/config/
- Plugins: https://vite.dev/plugins/

### React
- Official: https://react.dev/
- Reference: https://react.dev/reference/react

### Hono API Framework
- Docs: https://hono.dev/
- Middleware: https://hono.dev/docs/api/middleware/

### Drizzle ORM
- Docs: https://orm.drizzle.team/
- PostgreSQL: https://orm.drizzle.team/docs/overview

### Tailwind CSS v4
- Docs: https://tailwindcss.com/docs
- Migration: https://tailwindcss.com/docs/upgrade-guide

### Redis
- Commands: https://redis.io/commands
- Node.js: https://github.com/redis/ioredis

### DigitalOcean API
- Docs: https://docs.digitalocean.com/reference/api/api-reference/

### Cloudflare API
- Docs: https://developers.cloudflare.com/api/

## Quick Reference Commands

```bash
# Check if a package supports a feature
pnpm json <package-name> | grep -A 10 "keywords"

# Find where a function is used
grep -r "functionName" apps/ --include="*.ts" --include="*.tsx"

# Check package version compatibility
pnpm why <package-name>

# Read package documentation locally
cat node_modules/<package-name>/README.md
```

## Rule Enforcement

Before executing any of these tools, documentation must be checked:
- Edit
- Write
- Bash (for install/upgrade commands)
- TaskCreate (for implementation tasks)

**Exceptions**: Reading files (Read, Glob, Grep) - these ARE documentation checking tools.

## Documentation Sources in This Project

- `README.md` - Project overview
- `CLAUDE_RULES.md` - This file
- `apps/web/VITE_GUIDE.md` - Vite specific guide
- `PLAN.md` - Implementation plan (from plan mode)
- `.env.example` - Environment variable documentation
- Code comments in:
  - `apps/api/src/` - Backend code
  - `apps/web/src/` - Frontend code
  - `packages/` - Shared packages

## Signing Off

When implementing a feature, add a comment citing the documentation source:

```typescript
// Configure proxy for API requests during development
// https://vite.dev/config/server-options#server-proxy
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    },
  },
}
```

This creates a traceable decision trail and helps future maintenance.

---

**Remember: 5 minutes reading documentation saves 2 hours of debugging.**

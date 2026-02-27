# Claude Code Instructions for MiniClaw-CC

## 🚨 Prime Directive: Documentation First

**Before making ANY code changes:**
1. Search for existing implementation
2. Read relevant documentation
3. Understand the full context
4. Then make minimal, informed changes

## 📚 MCP Servers Available

The following MCP servers are configured for documentation access:

### @modelcontextprotocol/server-filesystem
**Purpose**: Read local project files and documentation
**Usage**: Automatically available for reading code/docs

### Web Reader (mcp__web-reader__webReader)
**Purpose**: Fetch web documentation as markdown
**Usage**: Use before implementing new features

### Web Search (mcp__web-search-prime__webSearchPrime)
**Purpose**: Search for latest docs/examples
**Usage**: Use when unsure about current best practices

### GitHub Reader (mcp__zread__*)
**Purpose**: Read GitHub repositories and search docs
**Usage**: Check package source code and examples

## 🔄 Standard Workflow

```
Request → Search Docs → Read Code → Plan → Implement → Test
```

### Example: Adding a New Vite Plugin

**❌ Wrong way:**
```bash
pnpm add some-plugin
# Edit config without understanding
```

**✅ Right way:**
1. Search: "Vite plugin best practices 2026"
2. Read: https://vite.dev/guide/using-plugins
3. Check: Existing vite.config.ts
4. Plan: Where does plugin go? What options?
5. Implement: Minimal, informed change
6. Test: Verify it works

## 📋 Quick Documentation Links

| Technology | Documentation | Key Sections |
|------------|---------------|--------------|
| Vite | https://vite.dev/guide/ | CLI, Config, HMR |
| React | https://react.dev/ | Reference, Hooks |
| Hono | https://hono.dev/ | Middleware, Validators |
| Drizzle | https://orm.drizzle.team/ | Schema, Queries |
| Tailwind v4 | https://tailwindcss.com/docs | Migration, Theme |
| Redis | https://redis.io/docs | Commands, Patterns |
| DigitalOcean | https://docs.digitalocean.com/ | API reference |
| Cloudflare | https://developers.cloudflare.com/ | APIs, Workers |

## 🛠️ Essential Commands

```bash
# Find where code is used
grep -r "functionName" apps/ --include="*.ts"

# Check package versions
pnpm list <package-name>

# Read package README
cat node_modules/<package>/README.md

# Test TypeScript without building
pnpm typecheck

# Clean Vite cache (when stuck)
rm -rf apps/web/node_modules/.vite
```

## 📝 Code Comment Standard

Cite documentation sources in comments:

```typescript
// Using Vite proxy for API calls during development
// https://vite.dev/config/server-options#server-proxy
server: {
  proxy: {
    '/api': { target: 'http://localhost:4000' }
  }
}
```

## ⚡ Performance Tips

1. **Use Grep before Glob** - Grep is faster for content searches
2. **Read before Edit** - Always read file before editing
3. **Check deps before install** - Use `pnpm why` to check existing
4. **Test early, test often** - Don't batch changes

## 🚫 Prohibited Patterns

- Installing packages without checking docs first
- Editing files without reading them completely
- Copying code without understanding it
- Making "blind" changes based on assumptions
- Skipping documentation checks "to save time"

## ✅ Required Pre-Flight Checks

Before using Edit/Write tools:

- [ ] Searched for existing implementation
- [ ] Read relevant documentation
- [ ] Checked current file contents
- [ ] Understood the impact
- [ ] Identified dependencies

---

**5 minutes of reading saves 2 hours of debugging.**

_Last updated: 2025-02-26_

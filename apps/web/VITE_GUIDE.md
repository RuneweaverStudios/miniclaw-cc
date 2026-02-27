# Vite Guide for MiniClaw-CC

## Quick Reference

### Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (port 3000) |
| `pnpm dev:force` | Force re-bundle dependencies (clears cache) |
| `pnpm dev:debug` | Start with debug logs |
| `pnpm build` | Build for production |
| `pnpm preview` | Preview production build locally |

### Common Issues & Solutions

#### 1. Cached Import Errors
**Problem**: Module imports are cached and causing errors after code changes.

**Solution**:
```bash
# Kill vite and clear cache
pkill -f vite
rm -rf node_modules/.vite

# Restart dev server
pnpm dev
```

Or use the force flag:
```bash
pnpm dev:force
```

#### 2. Port Already in Use
**Problem**: Port 3000 is already occupied.

**Solution**:
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or Vite will auto-use next available port
```

#### 3. HMR Not Working
**Problem**: Hot Module Replacement not updating the browser.

**Solution**:
- Check that `server.strictPort: false` in vite.config.ts
- Try the `--force` flag to clear dependency cache
- Check browser console for WebSocket connection errors

### Configuration Highlights

**vite.config.ts**:
- ✅ API proxy to backend (port 4000)
- ✅ React Fast Refresh enabled
- ✅ Tailwind CSS v4 integration
- ✅ Path aliases (`@` → `/src`)
- ✅ Optimized dependency pre-bundling
- ✅ Production builds drop console logs

**Performance Tips**:
1. Use `--force` only when needed (it's slower)
2. Keep `node_modules` healthy with `pnpm install`
3. Use `pnpm typecheck` in separate terminal for type safety
4. Source maps enabled for debugging

### Monorepo Tips

- Workspace packages (`@miniclaw/shared`) are auto-detected
- Use `@/` alias for internal imports
- Changes to shared packages trigger HMR automatically

### Browser Extensions

- **Vite** indicator shows in browser tab
- HMR status in browser console
- Network tab shows optimized `/@vite/` and `/@fs/` paths

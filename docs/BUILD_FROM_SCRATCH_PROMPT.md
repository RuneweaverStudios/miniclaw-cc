# Complete Prompt: Build MiniClaw-CC From Scratch

Use this entire document as the **single detailed prompt** for an AI or team to rebuild the MiniClaw-CC application from scratch.

---

## 1. Product summary

Build **MiniClaw-CC**: a SaaS that gives users **instant access to pre-provisioned VPS servers** (AI agent runtimes) instead of waiting 5–15 minutes for provisioning. Users sign up with Google, pick a stack (e.g. OpenClaw or Nanobot) and model, and get a server from a **standby pool** in sub-seconds. The backend manages the pool (replenish, health checks, reclamation), allocates servers to users, and handles billing (Stripe) and per-droplet OpenRouter API keys.

**Core flows:**
- **Signup / login:** Google OAuth via Supabase; after callback, sync user to our backend and issue a JWT.
- **Checkout:** User selects framework/model/channel (e.g. Telegram); can be free trial or paid.
- **Deploy:** Allocate a server from the pool, configure it (stack + Telegram + OpenRouter key), return SSH/details.
- **Dashboard:** List user’s servers, health, usage; settings and billing.

**Domain:** Production at **miniclaw.xyz** and **www.miniclaw.xyz**; API at **api.miniclaw.xyz**.

---

## 2. Tech stack

- **Monorepo:** pnpm workspaces + Turbo. Apps: `api` (backend), `web` (frontend). Packages: `shared`, `config`.
- **Backend:** Node 22+, **Hono** (HTTP), **Drizzle ORM** (Postgres), **BullMQ** + **Redis** (queue + pool state), **tsx** for dev/run. Auth: JWT (our API) + **Supabase** for OAuth (Google). External: **DigitalOcean** (droplets), **OpenRouter** (LLM keys), **Stripe** (billing).
- **Frontend:** **React 18**, **Vite**, **React Router** (data/router APIs), **Tailwind**, **Supabase** (auth client). Env: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- **Database:** PostgreSQL (e.g. Supabase Postgres). Schema: users, user_servers, pool_servers, allocations, subscriptions, invoices, token_purchases, audit_logs.
- **Deployment:** **Render**: Web Service (API), Redis service, Static Site (frontend). Custom domains: miniclaw.xyz, www.miniclaw.xyz, api.miniclaw.xyz.

---

## 3. Monorepo structure

```
miniclaw-cc/
├── apps/
│   ├── api/                    # Hono API (port 4000)
│   │   ├── src/
│   │   │   ├── index.ts        # App entry, CORS, global onError, routes, start server
│   │   │   ├── routes/         # auth, pool, servers, servers-allocate, billing, user, webhooks, proxy, admin
│   │   │   ├── services/       # auth, pool-manager, allocator, provisioner, health-check, openrouter, etc.
│   │   │   ├── workers/        # replenisher, health-monitor, reclaimer, install, pool-sync
│   │   │   ├── db/schema.ts    # Drizzle schema
│   │   │   └── lib/            # db, redis, digitalocean, queue, ssh
│   │   ├── drizzle.config.ts
│   │   └── package.json        # "dev": "tsx watch src/index.ts", "db:push": "drizzle-kit push"
│   └── web/                    # Vite + React (port 3000)
│       ├── src/
│       │   ├── App.tsx         # createBrowserRouter, routes, protected/public/admin loaders
│       │   ├── pages/          # landing, auth (signup, login, callback), checkout, deploy-wizard, dashboard, servers, settings, admin
│       │   └── lib/            # supabase, api
│       ├── vite.config.ts      # proxy /api -> http://localhost:4000
│       └── package.json        # "dev": "vite", "build": "tsc && vite build"
├── packages/
│   ├── shared/                 # Shared types/utils
│   └── config/                 # Shared config
├── render.yaml                 # miniclaw-api (web), miniclaw-redis; build/start for API only
├── package.json               # "dev": "turbo run dev"
└── turbo.json                 # dev persistent, build with outputs
```

---

## 4. Backend (API) requirements

- **Framework:** Hono app with CORS (allow `FRONTEND_URL`, localhost 3000/5173, and www/non-www variant). Logger and prettyJSON middleware. Global `app.onError` that always returns JSON (including 500) and, for “relation … does not exist” errors, a hint to run `pnpm db:push` in apps/api.
- **Startup:** In **production**, require Redis; if Redis is down, exit. In **development** (NODE_ENV !== 'production'), allow startup without Redis (log warning, skip background workers) so auth/sync works with only Postgres.
- **Auth routes (`/api/auth`):**
  - `GET /`, `GET /me`: Return current user from JWT (Bearer) and DB.
  - `POST /signin`, `POST /signup`: Email/password sign-in/sign-up (optional; primary is OAuth).
  - **`POST /sync`:** Body: `{ email, name?, avatar?, provider?, providerId?, metadata? }`. Validate email. Upsert user in `users` (onConflictDoUpdate on email), return `{ user, token }` (JWT). Used after Supabase OAuth callback to create/update our user and issue API JWT. On error return JSON with message; if DB relation missing, include hint.
- **Other routes:** Pool status, server allocation (from pool), billing (Stripe), user profile, webhooks (Stripe), proxy, admin pool/user management. All authenticated routes use JWT from `Authorization: Bearer <token>`.
- **Database:** Drizzle with Postgres. Tables: users (id, email, name, avatar, provider, providerId, plan, planStatus, status, lastLoginAt, etc.), user_servers, pool_servers, allocations, subscriptions, invoices, token_purchases, audit_logs. Use `drizzle-kit push` for schema apply.
- **Redis:** Used for pool state and BullMQ. In dev, API can run without Redis (workers skipped).
- **Health:** `GET /health` returns 200 with status (healthy/degraded) and Redis up/down.

---

## 5. Frontend requirements

- **Auth flow:** Signup/Login pages use Supabase `signInWithOAuth({ provider: 'google' })`. Redirect to `/auth/callback`. On callback: `getSession()`, then POST to backend `POST /api/auth/sync` (URL: `VITE_API_URL` if set, else `/api/auth/sync`). Send `email`, `name`, `avatar`, `provider: 'google'`, `providerId`, and optional wizard `metadata`. On success: store `token`, `user_id`, `user_role` in localStorage and redirect to `/checkout`. On 500 with **empty body**, show a clear message: “Backend sync failed (no response). Start the API: run pnpm dev in apps/api. If the DB is missing tables, run pnpm db:push in apps/api.” and display it in the error state UI.
- **Supabase client:** If `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is missing, use a no-op client so the app doesn’t crash; only use the real client when both are set.
- **Routing:** `/` landing, `/signup`, `/login`, `/auth/callback`, `/checkout`, `/checkout/success`, `/deploy`, `/dashboard`, `/servers`, `/settings/*`, `/admin/*`. Protected routes require `localStorage.auth_token`; else redirect to login. Admin routes also require `user_role === 'admin'`.
- **Vite:** Dev server port 3000; proxy `'/api'` to `http://localhost:4000`. Build output `dist`. Env: `VITE_API_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

---

## 6. Deployment (Render + miniclaw.xyz)

- **API (miniclaw-api):** Web Service, Node, build: `pnpm install --filter @miniclaw/api --filter @miniclaw/shared --filter @miniclaw/config`, start: `cd apps/api && npx tsx src/index.ts`. Health path `/health`. Env: `NODE_ENV=production`, `PORT=4000`, `REDIS_HOST`/`REDIS_PORT` from linked Redis, `DATABASE_URL`, `DIGITALOCEAN_TOKEN`, `OPENROUTER_API_KEY`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `FRONTEND_URL=https://miniclaw.xyz`, `API_URL=https://api.miniclaw.xyz`, plus pool/worker vars. Custom domain: **api.miniclaw.xyz**.
- **Redis (miniclaw-redis):** Redis service, same region as API, internal only.
- **Static site (frontend):** Render Static Site, same repo, root directory = repo root. Build: `pnpm install && pnpm --filter @miniclaw/web build`. Publish directory: `apps/web/dist`. Env: `VITE_API_URL=https://api.miniclaw.xyz`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Custom domains: **miniclaw.xyz**, **www.miniclaw.xyz**.
- **Database:** Run once against production Postgres: `cd apps/api && pnpm db:push` with production `DATABASE_URL` (e.g. Supabase).
- **Google OAuth:** Authorized redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`. Authorized JavaScript origins: `https://miniclaw.xyz`, `https://www.miniclaw.xyz`, `http://localhost:3000` (and 5173 if used).
- **Supabase:** Site URL = `https://www.miniclaw.xyz` (or miniclaw.xyz). Redirect URLs include `https://www.miniclaw.xyz/**`, `https://miniclaw.xyz/**`.

---

## 7. Implementation details to match

- **CORS:** Build allowed origins from `FRONTEND_URL`; include both www and non-www when one is set.
- **Auth sync:** Validate email format; safe body parse (e.g. `.catch(() => ({}))`). Upsert user with `plan: 'free'`, `planStatus: 'trial'`, `status: 'active'`, `lastLoginAt: now`. Return JWT with `userId`, `email`, `name`, `plan`.
- **Error responses:** Every 500 must return JSON (e.g. `{ error: { message, hint? } }`). Global `onError` in Hono ensures uncaught errors still return JSON. Sync route catch block returns JSON with optional “relation does not exist” hint.
- **Dev experience:** API starts in dev even when Redis is down (workers skipped). Frontend shows actionable message when sync returns 500 with empty body (API not running or DB tables missing).

---

## 8. Checklist for “build from scratch”

1. Create pnpm monorepo with `apps/api`, `apps/web`, `packages/shared`, `packages/config`; Turbo with `dev` (persistent) and `build`.
2. Implement Drizzle schema (users, user_servers, pool_servers, allocations, subscriptions, invoices, token_purchases, audit_logs) and `db:push`.
3. Implement Hono API: CORS, global onError, health, auth (/, /me, /signin, /signup, **POST /sync**), then pool, servers, allocate, billing, user, webhooks, proxy, admin routes.
4. Implement auth service (JWT sign/verify) and sync logic (upsert user, return user + token).
5. In API startup: production = require Redis and exit if down; development = allow no Redis and skip workers.
6. Implement React app: Supabase client (no-op when env missing), routes (landing, signup, login, auth/callback, checkout, deploy, dashboard, servers, settings, admin).
7. Auth callback: getSession(), POST /api/auth/sync with user info and optional metadata, on success store token and redirect to checkout; on 500 empty body show “Start API / db:push” message in UI.
8. Vite proxy `/api` to `http://localhost:4000`; build with `VITE_*` env.
9. Add `render.yaml` for API + Redis; document Static Site build and env; document custom domains (miniclaw.xyz, www, api.miniclaw.xyz), DB push, Google OAuth and Supabase URL config.

---

## 9. Optional extras

- Pool management scripts: pool:check, pool:refill, test:onboarding, pool:deallocate, etc., in `apps/api` as CLI scripts.
- Stripe webhooks and checkout session creation; token purchases and per-droplet OpenRouter key limits.
- Admin UI for pool and user management.
- Deploy wizard: framework/model/channel selection, then allocate and show server details/SSH.

Use this document as the single source of requirements when rebuilding MiniClaw-CC from scratch.

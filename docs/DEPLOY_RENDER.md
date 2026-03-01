# Deploying to Production on Render

This guide covers how to push the MiniClaw API (and optional Redis) to production using [Render](https://render.com).

## What’s in `render.yaml`

- **miniclaw-api** – Web service (Node) running the API.
- **miniclaw-redis** – Redis instance used by the API (e.g. jobs, cache).

The **web app** (Vite/React in `apps/web`) is not in this blueprint; deploy it separately (e.g. Vercel, Netlify, or Render Static Site) and set `VITE_API_URL` to your API URL.

---

## 1. One-time setup (Blueprint from repo)

1. **Render account**  
   Sign up at [render.com](https://render.com).

2. **Connect the repo**  
   - Dashboard → **New** → **Blueprint**.  
   - Connect your Git provider and select the `miniclaw-cc` repository.  
   - Render will detect `render.yaml` in the repo root.

3. **Create the Blueprint**  
   - Click **Apply**.  
   - Render creates:
     - **miniclaw-api** (Web Service)
     - **miniclaw-redis** (Redis).

4. **Set secret environment variables**  
   In the **miniclaw-api** service → **Environment** tab, set (do not commit these):

   | Key | Description |
   |-----|-------------|
   | `DATABASE_URL` | Postgres connection string (e.g. Render Postgres or external). |
   | `DIGITALOCEAN_TOKEN` | DigitalOcean API token for pool/droplets. |
   | `OPENROUTER_API_KEY` | OpenRouter API key. |
   | `JWT_SECRET` | Strong random secret (or use “Generate” in Render). |
   | `GOOGLE_CLIENT_ID` | Google OAuth client ID. |
   | `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. |
   | `STRIPE_SECRET_KEY` | Stripe secret key. |
   | `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret. |

   Optional overrides:

   | Key | Default in `render.yaml` |
   |-----|---------------------------|
   | `FRONTEND_URL` | `https://miniclaw.xyz` |
   | `API_URL` | `https://api.miniclaw.xyz` |

   Save after editing.

---

## 1b. Manual setup (New Web Service + Redis)

If you created the API as a **New Web Service** (not via Blueprint), you must add Redis and env vars yourself.

**Step 1: Create a Redis service**

1. Render Dashboard → **New** → **Redis**.
2. Name it (e.g. `miniclaw-redis`), choose the **same region** as your API (e.g. Oregon), then Create.
3. Open the new Redis service. In **Info** or **Connection**, copy the **Internal Redis URL** (for use only by other Render services). It looks like:
   - `redis://red-xxxxxxxx:6379`  
   - or with password: `redis://default:YOUR_PASSWORD@red-xxxxxxxx:6379`

**Step 2: Set Redis env vars on your API service**

In your API service (e.g. **miniclaw-api-2**) → **Environment** → Add:

| Key | Value |
|-----|--------|
| `REDIS_HOST` | Hostname from Internal Redis URL (e.g. `red-xxxxxxxx`) |
| `REDIS_PORT` | `6379` |
| `REDIS_PASSWORD` | Only if the Internal Redis URL contains a password (the part after `default:` and before `@`) |

Example: for `redis://default:abc123@red-abc123xyz:6379` set  
`REDIS_HOST=red-abc123xyz`, `REDIS_PORT=6379`, `REDIS_PASSWORD=abc123`.

Alternatively you can set a single **REDIS_URL** (e.g. the Internal Redis URL from Render) instead of host/port/password.

Save, then **Manual Deploy** (or trigger a new deploy). The API will connect to Redis instead of localhost.

---

## 2. Pushing to production (ongoing)

After the Blueprint is set up, **every push to the branch you connected** can trigger a deploy:

1. **Default (auto-deploy)**  
   - In **miniclaw-api** → **Settings** → **Build & Deploy**:  
     - **Auto-Deploy** = **Yes** (default).  
   - Push to that branch (e.g. `main`):  
     - Render runs the **Build Command** from `render.yaml`.  
     - Then runs the **Start Command**.  
     - New version goes live when the health check passes.

2. **Manual deploy**  
   - **miniclaw-api** → **Manual Deploy** → **Deploy latest commit**.

3. **Deploy a specific branch/commit**  
   - Change the service’s **Branch** in Settings to the desired branch, then deploy; or use **Manual Deploy** after switching branch.

---

## 3. Build and start (from `render.yaml`)

- **Build:**  
  `pnpm install --filter @miniclaw/api --filter @miniclaw/shared --filter @miniclaw/config`  
  (installs API and its dependencies in the monorepo.)

- **Start:**  
  `cd apps/api && npx tsx src/index.ts`  
  (runs the API with tsx; ensure `PORT` is set, e.g. 4000 in Render.)

- **Health check:**  
  Render uses `healthCheckPath: /health`. The API must respond with 200 on `GET /health`.

---

## 4. Custom domain and env URLs

- In the **miniclaw-api** service, add a **Custom Domain** (e.g. `api.miniclaw.xyz`) and follow Render’s DNS instructions.
- Set **Environment**:
  - `API_URL` = `https://api.miniclaw.xyz` (or your API domain).
  - `FRONTEND_URL` = your frontend URL (e.g. `https://miniclaw.xyz`).

---

## 5. Frontend (web app)

- Build: from repo root, e.g. `pnpm install && pnpm --filter web build` (adjust to your `apps/web` script).
- Set **env**: `VITE_API_URL=https://api.miniclaw.xyz` (or your API URL) so the app calls the right API.
- Deploy the `apps/web/dist` (or equivalent) output to any static host; no changes to `render.yaml` required for the API.

---

## 6. Troubleshooting

| Issue | What to check |
|-------|----------------|
| Build fails | Logs → Build; ensure `pnpm` and Node version are correct; install all required workspace packages if you add new ones. |
| Service won’t start | Logs → Deploy; check `DATABASE_URL`, `REDIS_*`, `PORT`. |
| Health check fails | Ensure `/health` returns 200 and Redis (and DB if used there) are reachable. |
| **Redis ECONNREFUSED localhost:6379** | The service that is deploying has no Redis. Use the Blueprint-linked **miniclaw-api** (so REDIS_HOST/REDIS_PORT are set from miniclaw-redis), or on your API service add **REDIS_HOST** and **REDIS_PORT** (and **REDIS_PASSWORD** if needed) from your Redis service’s Internal connection info. See § 1b. |
| 401/403 from API | Verify `JWT_SECRET`, `FRONTEND_URL`, and CORS/origin settings match your frontend. |

---

**Summary:** Connect the repo as a Blueprint once, set secret env vars, then push to the connected branch (or use Manual Deploy) to push the API to production on Render. Deploy the web app elsewhere with `VITE_API_URL` pointing at the Render API URL.

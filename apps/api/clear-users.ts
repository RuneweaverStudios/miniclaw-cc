/**
 * Clear all users from the database.
 * Uses DATABASE_URL from env (e.g. apps/api/.env).
 * Related rows (user_servers, allocations, subscriptions, etc.) are removed or nulled per schema FKs.
 *
 * Run: cd apps/api && pnpm exec tsx clear-users.ts
 * Or:   pnpm --filter @miniclaw/api db:clear-users
 */
import 'dotenv/config';
import { getDb } from './src/lib/db/index.js';
import { users } from './src/db/schema.js';

async function main() {
  const db = getDb();
  const result = await db.delete(users);
  const count = (result as { rowCount?: number }).rowCount ?? 0;
  console.log(`Deleted ${count} user(s) from the database.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

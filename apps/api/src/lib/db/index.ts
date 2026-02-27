import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema.js';

let db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!db) {
    const url = process.env.DATABASE_URL || 'postgresql://miniclaw:miniclaw@localhost:5432/miniclaw_dev';
    db = drizzle(url, { schema });
  }
  return db;
}

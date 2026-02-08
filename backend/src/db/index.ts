import { neon } from '@neondatabase/serverless';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from '../services/config';
import * as schema from './schema';

export * as schema from './schema';

const client = neon(config.postgresUrl);
export const db = drizzle({ client, schema });

export const dbHealth = async (): Promise<{ ok: boolean }> => {
  try {
    await db.execute(sql`select 1`);
    return { ok: true };
  } catch {
    return { ok: false };
  }
};

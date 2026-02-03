import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { config } from '../services/config';

type DrizzleClient = ReturnType<typeof drizzle>;

let client: DrizzleClient | null = null;

export const getDb = (): DrizzleClient | null => {
  if (!config.postgresUrl) return null;
  if (client) return client;
  const sql = neon(config.postgresUrl);
  client = drizzle({ client: sql });
  return client;
};

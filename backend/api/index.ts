import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../src/app';
import { assertRedisConnection } from '../src/services/cache';
import { dbHealth } from '../src/db';

const app = createApp();

let readinessPromise: Promise<void> | null = null;

const ensureDependenciesReady = async (): Promise<void> => {
  if (!readinessPromise) {
    readinessPromise = (async () => {
      await assertRedisConnection();
      const database = await dbHealth();
      if (!database.ok) {
        throw new Error('Database connection failed during startup');
      }
    })().catch((error) => {
      readinessPromise = null;
      throw error;
    });
  }

  return readinessPromise;
};

export default async (req: IncomingMessage, res: ServerResponse) => {
  await ensureDependenciesReady();
  return app(req, res);
};

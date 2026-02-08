import dotenv from 'dotenv';
import { createApp } from './app';
import { config } from './services/config';
import { assertRedisConnection } from './services/cache';
import { dbHealth } from './db';

dotenv.config();

const bootstrap = async () => {
  await assertRedisConnection();
  const database = await dbHealth();
  if (!database.ok) {
    throw new Error('Database connection failed during startup');
  }

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
  });
};

bootstrap().catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});

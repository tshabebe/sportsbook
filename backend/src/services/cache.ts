import { createClient, RedisClientType } from 'redis';
import { config } from './config';

type CacheValue = {
  value: string;
  expiresAt: number;
};

class MemoryCache {
  private store = new Map<string, CacheValue>();

  get(key: string): string | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, { value, expiresAt });
  }
}

const memoryCache = new MemoryCache();
let redisClient: RedisClientType | null = null;

const ensureRedis = async (): Promise<RedisClientType | null> => {
  if (!config.redisUrl) return null;
  if (redisClient) return redisClient;
  redisClient = createClient({ url: config.redisUrl });
  redisClient.on('error', (err) => {
    console.error('Redis error', err);
  });
  await redisClient.connect();
  return redisClient;
};

export const cacheGet = async (key: string): Promise<string | null> => {
  try {
    const client = await ensureRedis();
    if (client) {
      const value = await client.get(key);
      return value ?? null;
    }
  } catch (err) {
    console.error('Redis get failed, falling back to memory', err);
  }
  return memoryCache.get(key);
};

export const cacheSet = async (
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> => {
  try {
    const client = await ensureRedis();
    if (client) {
      await client.setEx(key, ttlSeconds, value);
      return;
    }
  } catch (err) {
    console.error('Redis set failed, falling back to memory', err);
  }
  memoryCache.set(key, value, ttlSeconds);
};

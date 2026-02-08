import { config } from './config';

type UpstashResponse<T> = {
  result?: T;
  error?: string;
};

const upstashBaseUrl = config.upstashRedisRestUrl.replace(/\/+$/, '');

const executeUpstash = async <T>(
  command: Array<string | number>,
): Promise<T | null> => {
  const response = await fetch(upstashBaseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.upstashRedisRestToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upstash request failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as UpstashResponse<T>;
  if (payload.error) {
    throw new Error(`Upstash command failed: ${payload.error}`);
  }

  return payload.result ?? null;
};

export const cacheGet = async (key: string): Promise<string | null> => {
  const result = await executeUpstash<string>(['GET', key]);
  return result ?? null;
};

export const cacheSet = async (
  key: string,
  value: string,
  ttlSeconds: number,
): Promise<void> => {
  await executeUpstash<string>(['SETEX', key, ttlSeconds, value]);
};

export const cacheHealth = async (): Promise<{ backend: 'redis'; ok: boolean }> => {
  try {
    const pong = await executeUpstash<string>(['PING']);
    return { backend: 'redis', ok: pong === 'PONG' };
  } catch {
    return { backend: 'redis', ok: false };
  }
};

export const assertRedisConnection = async (): Promise<void> => {
  const health = await cacheHealth();
  if (!health.ok) {
    throw new Error('Redis connection failed during startup');
  }
};


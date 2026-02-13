import dotenv from 'dotenv';

dotenv.config();

const toInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const sanitizeDatabaseUrl = (value: string | undefined): string => {
  if (!value) return '';
  try {
    const url = new URL(value);
    url.searchParams.delete('channel_binding');
    return url.toString();
  } catch {
    return value;
  }
};

const required = (value: string | undefined, key: string): string => {
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const retailAuthSecret = required(
  process.env.RETAIL_AUTH_SECRET ?? process.env.JWT_SECRET,
  'RETAIL_AUTH_SECRET',
);
const adminPasswordRaw = process.env.ADMIN_PASSWORD_HASH
  ? process.env.ADMIN_PASSWORD_HASH
  : `plain:${process.env.ADMIN_PASSWORD ?? 'admin123'}`;

export const config = {
  port: toInt(process.env.PORT, 3001),
  apiFootballBaseUrl:
    process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io',
  apiFootballKey: required(process.env.API_FOOTBALL_KEY, 'API_FOOTBALL_KEY'),
  upstashRedisRestUrl: required(
    process.env.UPSTASH_REDIS_REST_URL,
    'UPSTASH_REDIS_REST_URL',
  ),
  upstashRedisRestToken: required(
    process.env.UPSTASH_REDIS_REST_TOKEN,
    'UPSTASH_REDIS_REST_TOKEN',
  ),
  postgresUrl: sanitizeDatabaseUrl(
    required(process.env.DATABASE_URL, 'DATABASE_URL'),
  ),
  walletUrl: required(process.env.WALLET_URL, 'WALLET_URL'),
  walletPassKey: required(
    process.env.PASS_KEY ?? process.env.WALLET_API_KEY,
    'PASS_KEY',
  ),
  retailAuthSecret,
  adminAuthSecret: process.env.ADMIN_AUTH_SECRET ?? retailAuthSecret,
  adminUsername: process.env.ADMIN_USERNAME ?? 'admin',
  adminPasswordHash: adminPasswordRaw,
  retailBookingTtlSeconds: toInt(process.env.RETAIL_BOOKING_TTL_SECONDS, 60 * 60 * 72),
  walletGameName: process.env.WALLET_GAME_NAME ?? 'Sportsbook',
  cacheTtlSeconds: {
    default: toInt(process.env.CACHE_TTL_DEFAULT, 60),
    short: toInt(process.env.CACHE_TTL_SHORT, 60),
    medium: toInt(process.env.CACHE_TTL_MEDIUM, 3600),
    long: toInt(process.env.CACHE_TTL_LONG, 86400),
    status: toInt(process.env.CACHE_TTL_STATUS, 60),
    fixturesLive: toInt(process.env.CACHE_TTL_FIXTURES_LIVE, 60),
    oddsLive: toInt(process.env.CACHE_TTL_ODDS_LIVE, 15),
  },
  risk: {
    minStake: toInt(process.env.RISK_MIN_STAKE, 1),
    maxStake: toInt(process.env.RISK_MAX_STAKE, 1000),
    maxPayout: toInt(process.env.RISK_MAX_PAYOUT, 100000),
    minOdd: toInt(process.env.RISK_MIN_ODD, 1),
    maxOdd: toInt(process.env.RISK_MAX_ODD, 1000),
    maxExposurePerOutcome: toInt(process.env.RISK_MAX_EXPOSURE_PER_OUTCOME, 50000),
    snapshotMaxAgeSeconds: toInt(process.env.RISK_SNAPSHOT_MAX_AGE_SECONDS, 60),
  },
};

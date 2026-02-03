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

export const config = {
  port: toInt(process.env.PORT, 3001),
  apiFootballBaseUrl:
    process.env.API_FOOTBALL_BASE_URL ?? 'https://v3.football.api-sports.io',
  apiFootballKey: process.env.API_FOOTBALL_KEY ?? '',
  redisUrl: process.env.REDIS_URL ?? '',
  postgresUrl: sanitizeDatabaseUrl(process.env.DATABASE_URL ?? ''),
  walletUrl: process.env.WALLET_URL ?? '',
  walletPassKey: process.env.PASS_KEY ?? process.env.WALLET_API_KEY ?? '',
  walletGameName: process.env.WALLET_GAME_NAME ?? 'Sportsbook',
  cacheTtlSeconds: {
    default: toInt(process.env.CACHE_TTL_DEFAULT, 60),
    status: toInt(process.env.CACHE_TTL_STATUS, 60),
    fixturesLive: toInt(process.env.CACHE_TTL_FIXTURES_LIVE, 60),
    oddsLive: toInt(process.env.CACHE_TTL_ODDS_LIVE, 60),
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

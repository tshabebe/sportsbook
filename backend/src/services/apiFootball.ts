import { config } from './config';
import { cacheGet, cacheSet } from './cache';
import { HttpError } from '../lib/http';

type ApiFootballResponse<T> = {
  get: string;
  parameters: Record<string, string | number | boolean>;
  errors: unknown[];
  results: number;
  paging: { current: number; total: number };
  response: T;
};

// Cache Duration Constants (in seconds)
const TTL = {
  LIVE: 5,           // /odds/live
  FAST: 15,          // /fixtures/events, /fixtures (live), h2h
  MINUTE: 60,        // /fixtures/statistics, /fixtures/players
  SHORT: 3600,       // /standings, /leagues, /predictions (1h)
  MEDIUM: 10800,     // /odds (pre-match) - 3h per docs
  LONG: 86400,       // Static data: teams, venues, countries, etc. (24h)
};

const getTtlForPath = (path: string, params: Record<string, any> = {}): number => {
  // Live Data
  if (path === '/odds/live') return TTL.LIVE;
  if (path === '/fixtures' && (params.live || params.status?.includes('LIVE'))) return TTL.FAST;
  if (path === '/fixtures/events') return TTL.FAST;
  if (path === '/fixtures/headtohead') return TTL.FAST;

  // Short Term (1 min)
  if (path === '/fixtures/statistics') return TTL.MINUTE;
  if (path === '/fixtures/players') return TTL.MINUTE;
  if (path === '/odds/live/bets') return TTL.MINUTE; // Available bets for live odds change often

  // Medium Term (Pre-match Odds - 3h)
  if (path === '/odds') return TTL.MEDIUM;

  // Hourly (1h)
  if (path === '/standings') return TTL.SHORT;
  if (path === '/fixtures/lineups') return 900; // 15 mins
  if (path === '/predictions') return TTL.SHORT;
  if (path === '/leagues') return TTL.SHORT;

  // Long Term (24h) - Default for static resources
  return TTL.LONG;
};

const buildUrl = (
  path: string,
  params?: Record<string, string | number | boolean>,
): string => {
  const url = new URL(path, config.apiFootballBaseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
};

const buildCacheKey = (
  path: string,
  params?: Record<string, string | number | boolean>,
): string => {
  const keyBase = path.replace(/\//g, ':').replace(/^:/, '');
  if (!params || Object.keys(params).length === 0) {
    return `api-football:${keyBase}`;
  }
  const pairs = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `api-football:${keyBase}?${pairs}`;
};

const getHeaders = (): Record<string, string> => {
  if (!config.apiFootballKey) {
    throw new HttpError(503, 'API_FOOTBALL_UNAVAILABLE', 'Missing API_FOOTBALL_KEY');
  }
  return {
    'x-apisports-key': config.apiFootballKey,
  };
};

const fetchJson = async <T>(url: string): Promise<ApiFootballResponse<T>> => {
  const response = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
  });
  if (response.status === 204) {
    return {
      get: '',
      parameters: {},
      errors: [],
      results: 0,
      paging: { current: 0, total: 0 },
      response: [] as unknown as T,
    };
  }
  if (!response.ok) {
    const text = await response.text();
    // 499 is API-Sports timeout, treat as error
    throw new HttpError(
      502,
      'UPSTREAM_API_FOOTBALL_ERROR',
      `API-Football error ${response.status}: ${text}`,
    );
  }
  return (await response.json()) as ApiFootballResponse<T>;
};

export const apiFootball = {
  /**
   * Generic proxy function that handles caching based on path and params.
   */
  proxy: async <T = any>(
    path: string,
    params: Record<string, any> = {},
  ): Promise<ApiFootballResponse<T>> => {
    const ttl = getTtlForPath(path, params);
    const cacheKey = buildCacheKey(path, params);
    const url = buildUrl(path, params);

    // 1. Try Cache
    const cached = await cacheGet(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as ApiFootballResponse<T>;
      } catch (e) {
        console.warn('Failed to parse cached value', e);
      }
    }

    // 2. Fetch API
    console.log(`[API-Football] Proxy Fetching: ${path} (TTL: ${ttl}s)`);
    const data = await fetchJson<T>(url);

    // 3. Set Cache (if no errors and legitimate response)
    if (data && !data.errors?.length) {
      await cacheSet(cacheKey, JSON.stringify(data), ttl);
    }

    return data;
  }
};

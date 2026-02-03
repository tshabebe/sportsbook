import { config } from './config';
import { cacheGet, cacheSet } from './cache';

type ApiFootballResponse<T> = {
  get: string;
  parameters: Record<string, string | number | boolean>;
  errors: unknown[];
  results: number;
  paging: { current: number; total: number };
  response: T;
};

const buildUrl = (
  path: string,
  params?: Record<string, string | number | boolean>,
): string => {
  const url = new URL(path, config.apiFootballBaseUrl);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value));
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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  return `api-football:${keyBase}?${pairs}`;
};

const getHeaders = (): Record<string, string> => {
  if (!config.apiFootballKey) {
    throw new Error('Missing API_FOOTBALL_KEY');
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
    throw new Error(`API-Football error ${response.status}: ${text}`);
  }
  return (await response.json()) as ApiFootballResponse<T>;
};

export const fetchWithCache = async <T>(
  cacheKey: string,
  url: string,
  ttlSeconds: number,
): Promise<ApiFootballResponse<T>> => {
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return JSON.parse(cached) as ApiFootballResponse<T>;
  }
  const data = await fetchJson<T>(url);
  await cacheSet(cacheKey, JSON.stringify(data), ttlSeconds);
  return data;
};

export const fetchApi = async <T>(
  path: string,
  params: Record<string, string | number | boolean> | undefined,
  ttlSeconds: number,
): Promise<ApiFootballResponse<T>> => {
  const url = buildUrl(path, params);
  const cacheKey = buildCacheKey(path, params);
  return fetchWithCache<T>(cacheKey, url, ttlSeconds);
};

export const apiFootball = {
  status: () =>
    fetchWithCache(
      'api-football:status',
      buildUrl('/status'),
      config.cacheTtlSeconds.status,
    ),
  fixturesLive: () =>
    fetchWithCache(
      'api-football:fixtures:live',
      buildUrl('/fixtures', { live: 'all' }),
      config.cacheTtlSeconds.fixturesLive,
    ),
  oddsLive: () =>
    fetchWithCache(
      'api-football:odds:live',
      buildUrl('/odds/live'),
      config.cacheTtlSeconds.oddsLive,
    ),
};

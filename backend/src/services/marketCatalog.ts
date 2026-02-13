import { apiFootball } from './apiFootball';
import { isMarketNameSupported } from './settlementResolver';

type OddsBetCatalogRow = {
  id?: string | number;
  name?: string;
  bet?: {
    id?: string | number;
    name?: string;
  };
};

export type MarketCatalogEntry = {
  id: string;
  name: string;
  supported: boolean;
};

const MARKET_CATALOG_TTL_MS = 1000 * 60 * 30;

let marketCatalogCache:
  | { expiresAt: number; catalog: Map<string, MarketCatalogEntry> }
  | null = null;
let inFlightCatalogLoad: Promise<Map<string, MarketCatalogEntry>> | null = null;

const toCatalogMap = (
  rows: OddsBetCatalogRow[],
): Map<string, MarketCatalogEntry> => {
  const catalog = new Map<string, MarketCatalogEntry>();

  for (const row of rows) {
    const idRaw = row?.id ?? row?.bet?.id;
    const nameRaw = row?.name ?? row?.bet?.name;
    const id = String(idRaw ?? '').trim();
    const name = String(nameRaw ?? '').trim();
    if (!id || !name) continue;

    catalog.set(id, {
      id,
      name,
      supported: isMarketNameSupported(name),
    });
  }

  return catalog;
};

const cloneCatalog = (
  catalog: Map<string, MarketCatalogEntry>,
): Map<string, MarketCatalogEntry> =>
  new Map(catalog.entries());

export const loadMarketCatalog = async (): Promise<Map<string, MarketCatalogEntry>> => {
  const now = Date.now();
  if (marketCatalogCache && marketCatalogCache.expiresAt > now) {
    return cloneCatalog(marketCatalogCache.catalog);
  }

  if (!inFlightCatalogLoad) {
    inFlightCatalogLoad = (async () => {
      try {
        const payload = await apiFootball.proxy<OddsBetCatalogRow[]>('/odds/bets');
        const rows = Array.isArray(payload.response) ? payload.response : [];
        const catalog = toCatalogMap(rows);
        if (catalog.size > 0) {
          marketCatalogCache = {
            catalog,
            expiresAt: Date.now() + MARKET_CATALOG_TTL_MS,
          };
        }
        return catalog;
      } catch (error) {
        if (marketCatalogCache?.catalog?.size) {
          return marketCatalogCache.catalog;
        }
        throw error;
      } finally {
        inFlightCatalogLoad = null;
      }
    })();
  }

  return cloneCatalog(await inFlightCatalogLoad);
};

export type MarketPlacementValidation =
  | { ok: true; market: MarketCatalogEntry }
  | {
      ok: false;
      code: 'MISSING_MARKET_ID' | 'MARKET_NOT_SUPPORTED';
      message: string;
      details?: Record<string, unknown>;
    };

export const validateMarketForPlacement = (
  betId: string | number | undefined,
  catalog: Map<string, MarketCatalogEntry>,
): MarketPlacementValidation => {
  const marketId = String(betId ?? '').trim();
  if (!marketId) {
    return {
      ok: false,
      code: 'MISSING_MARKET_ID',
      message: 'Selection market id is required',
    };
  }

  const market = catalog.get(marketId);
  if (!market) {
    return {
      ok: false,
      code: 'MARKET_NOT_SUPPORTED',
      message: `Market ${marketId} is not supported`,
      details: { marketId },
    };
  }

  if (!market.supported) {
    return {
      ok: false,
      code: 'MARKET_NOT_SUPPORTED',
      message: `Market ${market.name} (${marketId}) is blocked for placement`,
      details: { marketId, marketName: market.name },
    };
  }

  return { ok: true, market };
};

export const __resetMarketCatalogCacheForTests = (): void => {
  marketCatalogCache = null;
  inFlightCatalogLoad = null;
};

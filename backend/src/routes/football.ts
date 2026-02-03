import { Router, Request, Response } from 'express';
import { apiFootball, fetchApi } from '../services/apiFootball';
import { storeOddsSnapshot } from '../services/db';
import { normalizeQuery } from './utils';

export const router = Router();

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const data = await apiFootball.status();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures/live', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const liveValue =
      params.live ??
      params.league ??
      'all';
    const data = await fetchApi('/fixtures', { ...params, live: liveValue }, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/odds/live', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds/live', params, 15);
    storeOddsSnapshot('api-football:odds/live', data).catch((err) => {
      console.error('Failed to store odds snapshot', err);
    });
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/leagues', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/leagues', params, 3600);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/teams', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/teams', params, 3600);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/standings', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/standings', params, 3600);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/fixtures', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/odds', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds', params, 60);
    storeOddsSnapshot('api-football:odds', data).catch((err) => {
      console.error('Failed to store odds snapshot', err);
    });
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/odds/bets', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds/bets', params, 3600);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/odds/bookmakers', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds/bookmakers', params, 3600);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/odds/mapping', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds/mapping', params, 3600);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/leagues/popular', async (_req: Request, res: Response) => {
  try {
    const resolveLeague = async (target: { name: string; country: string }) => {
      const data = await fetchApi('/leagues', { search: target.name }, 3600);
      const response = Array.isArray(data.response) ? data.response : [];
      const match =
        response.find(
          (item) =>
            String(item?.league?.name || '').toLowerCase() ===
              target.name.toLowerCase() &&
            String(item?.country?.name || '').toLowerCase() ===
              target.country.toLowerCase(),
        ) ??
        response.find(
          (item) =>
            String(item?.league?.name || '').toLowerCase().includes(target.name.toLowerCase()) &&
            String(item?.country?.name || '').toLowerCase() === target.country.toLowerCase(),
        ) ??
        response[0];

      return {
        name: target.name,
        country: target.country,
        id: match?.league?.id ?? null,
        type: match?.league?.type ?? null,
        logo: match?.league?.logo ?? null,
      };
    };

    const leagues = await Promise.all(popularTargets.map(resolveLeague));
    res.json({ ok: true, leagues });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

const fetchOddsMappingPages = async (pages: number) => {
  const results: Array<any> = [];
  for (let page = 1; page <= pages; page += 1) {
    const data = await fetchApi('/odds/mapping', { page }, 60);
    const response = Array.isArray(data.response) ? data.response : [];
    results.push(...response);
    if (data.paging?.current === data.paging?.total) {
      break;
    }
  }
  return results;
};

const popularTargets = [
  { name: 'Premier League', country: 'England' },
  { name: 'UEFA Champions League', country: 'World' },
  { name: 'La Liga', country: 'Spain' },
  { name: 'Serie A', country: 'Italy' },
  { name: 'Championship', country: 'England' },
  { name: 'Bundesliga', country: 'Germany' },
  { name: 'Eredivisie', country: 'Netherlands' },
  { name: 'Ligue 1', country: 'France' },
  { name: 'UEFA Europa League', country: 'World' },
  { name: 'UEFA Europa Conference League', country: 'World' },
  { name: 'FA Cup', country: 'England' },
  { name: 'Copa Libertadores', country: 'World' },
];

router.get('/leagues/with-odds', async (req: Request, res: Response) => {
  try {
    const pages = Number(req.query.pages ?? 2);
    const mapping = await fetchOddsMappingPages(
      Number.isFinite(pages) ? Math.max(1, pages) : 2,
    );
    const leagueIdsWithOdds = new Set(
      mapping.map((item) => Number(item?.league?.id)).filter((id) => Number.isFinite(id)),
    );

    const resolved = await Promise.all(
      popularTargets.map(async (target) => {
        const data = await fetchApi('/leagues', { search: target.name }, 3600);
        const response = Array.isArray(data.response) ? data.response : [];
        const match =
          response.find(
            (item) =>
              String(item?.league?.name || '').toLowerCase() ===
                target.name.toLowerCase() &&
              String(item?.country?.name || '').toLowerCase() ===
                target.country.toLowerCase(),
          ) ??
          response.find(
            (item) =>
              String(item?.league?.name || '')
                .toLowerCase()
                .includes(target.name.toLowerCase()) &&
              String(item?.country?.name || '').toLowerCase() ===
                target.country.toLowerCase(),
          ) ??
          response[0];

        return {
          id: match?.league?.id ?? null,
          name: target.name,
          country: target.country,
          type: match?.league?.type ?? null,
          logo: match?.league?.logo ?? null,
        };
      }),
    );
    const filtered = resolved.filter((league) => league.id && leagueIdsWithOdds.has(Number(league.id)));

    res.json({ ok: true, leagues: filtered });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

router.get('/fixtures/with-odds', async (req: Request, res: Response) => {
  try {
    const leagueId = Number(req.query.league);
    if (!Number.isFinite(leagueId)) {
      res.status(400).json({ ok: false, error: 'league query param required' });
      return;
    }
    const pages = Number(req.query.pages ?? 2);
    const mapping = await fetchOddsMappingPages(
      Number.isFinite(pages) ? Math.max(1, pages) : 2,
    );
    const candidates = mapping
      .filter((item) => Number(item?.league?.id) === leagueId)
      .map((item) => ({
        fixture: item.fixture,
        league: item.league,
        update: item.update,
      }));
    const maxChecks = Number(req.query.max_checks ?? 50);
    const fixtures: Array<any> = [];
    for (const item of candidates) {
      if (fixtures.length >= maxChecks) break;
      const fixtureId = Number(item?.fixture?.id);
      if (!Number.isFinite(fixtureId)) continue;
      const odds = await fetchApi('/odds', { fixture: fixtureId }, 60);
      storeOddsSnapshot(`api-football:odds:fixture:${fixtureId}`, odds).catch((err) => {
        console.error('Failed to store odds snapshot', err);
      });
      const response = Array.isArray(odds.response) ? odds.response : [];
      const hasMarkets = response.some((row: any) => {
        const bookmakers = Array.isArray(row?.bookmakers) ? row.bookmakers : [];
        const bookmakerHasBets = bookmakers.some(
          (b: any) => Array.isArray(b?.bets) && b.bets.length > 0,
        );
        const liveHasOdds = Array.isArray(row?.odds) && row.odds.length > 0;
        return bookmakerHasBets || liveHasOdds;
      });
      if (response.length > 0 && hasMarkets) {
        fixtures.push(item);
      }
    }
    res.json({ ok: true, fixtures, checked: Math.min(candidates.length, maxChecks) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

router.get('/fixtures/events', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/fixtures/events', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures/lineups', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/fixtures/lineups', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures/statistics', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/fixtures/statistics', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/predictions', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/predictions', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
router.get('/odds/live/bets', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds/live/bets', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures/rounds', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/fixtures/rounds', params, 86400);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures/headtohead', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/fixtures/headtohead', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures/players', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/fixtures/players', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/injuries', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/injuries', params, 3600);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

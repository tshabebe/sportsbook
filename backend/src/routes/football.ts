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
    // Optimized: Use hardcoded IDs to avoid 12 parallel API search calls (Rate Limit protection)
    // We can confidently construct the static data since these IDs are stable.
    const leagues = [
      { id: 39, name: 'Premier League', country: 'England', logo: 'https://media.api-sports.io/football/leagues/39.png', type: 'League' },
      { id: 2, name: 'UEFA Champions League', country: 'World', logo: 'https://media.api-sports.io/football/leagues/2.png', type: 'Cup' },
      { id: 140, name: 'La Liga', country: 'Spain', logo: 'https://media.api-sports.io/football/leagues/140.png', type: 'League' },
      { id: 135, name: 'Serie A', country: 'Italy', logo: 'https://media.api-sports.io/football/leagues/135.png', type: 'League' },
      { id: 78, name: 'Bundesliga', country: 'Germany', logo: 'https://media.api-sports.io/football/leagues/78.png', type: 'League' },
      { id: 61, name: 'Ligue 1', country: 'France', logo: 'https://media.api-sports.io/football/leagues/61.png', type: 'League' },
      { id: 3, name: 'UEFA Europa League', country: 'World', logo: 'https://media.api-sports.io/football/leagues/3.png', type: 'Cup' },
      { id: 848, name: 'UEFA Europa Conference League', country: 'World', logo: 'https://media.api-sports.io/football/leagues/848.png', type: 'Cup' },
      { id: 45, name: 'FA Cup', country: 'England', logo: 'https://media.api-sports.io/football/leagues/45.png', type: 'Cup' },
      { id: 13, name: 'Copa Libertadores', country: 'World', logo: 'https://media.api-sports.io/football/leagues/13.png', type: 'Cup' },
      { id: 88, name: 'Eredivisie', country: 'Netherlands', logo: 'https://media.api-sports.io/football/leagues/88.png', type: 'League' },
      { id: 40, name: 'Championship', country: 'England', logo: 'https://media.api-sports.io/football/leagues/40.png', type: 'League' },
    ];

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
  // Kept for reference or other endpoints but unused in simplified popular route
  { name: 'Premier League', country: 'England' },
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

    // 1. Fetch upcoming fixtures (Schedule) - Guarantees full fixture/team data
    // We fetch the next 10 games for the league.
    console.log(`Fetching schedule for league ${leagueId}...`);
    const fixturesData = await fetchApi('/fixtures', { league: leagueId, next: 10, status: 'NS' }, 60);
    const fixtures = Array.isArray(fixturesData.response) ? fixturesData.response : [];

    // 2. Enrich with Odds
    // We need to fetch odds for each fixture (in parallel for speed)
    console.log(`Enriching ${fixtures.length} fixtures with odds...`);
    const fixturesWithOdds = await Promise.all(fixtures.map(async (fixtureItem: any) => {
      const fixtureId = Number(fixtureItem?.fixture?.id);
      if (!fixtureId) return fixtureItem;

      // Fetch odds for this specific fixture
      const oddsData = await fetchApi('/odds', { fixture: fixtureId }, 60);
      // Store snapshot if needed
      if (oddsData.response) {
        storeOddsSnapshot(`api-football:odds:fixture:${fixtureId}`, oddsData).catch(console.error);
      }

      const oddsResponse = Array.isArray(oddsData.response) ? oddsData.response[0] : null;

      // Simplify odds extraction for the frontend MatchCard
      let formattedOdds = { home: "1.00", draw: "1.00", away: "1.00" };

      if (oddsResponse && Array.isArray(oddsResponse.bookmakers) && oddsResponse.bookmakers.length > 0) {
        // Look for "Match Winner" (id 1)
        const bookmaker = oddsResponse.bookmakers[0];
        const matchWinner = bookmaker.bets?.find((b: any) => b.id === 1 || b.name === "Match Winner");

        if (matchWinner && Array.isArray(matchWinner.values)) {
          formattedOdds = {
            home: matchWinner.values.find((v: any) => v.value === "Home")?.odd || "1.00",
            draw: matchWinner.values.find((v: any) => v.value === "Draw")?.odd || "1.00",
            away: matchWinner.values.find((v: any) => v.value === "Away")?.odd || "1.00",
          };
        }
      }

      return {
        ...fixtureItem,
        odds: formattedOdds
      };
    }));

    res.json({ ok: true, fixtures: fixturesWithOdds, checked: fixtures.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Error in /fixtures/with-odds:', message);
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

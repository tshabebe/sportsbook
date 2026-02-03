import { Router, Request, Response } from 'express';
import { apiFootball, fetchApi } from '../services/apiFootball';
import { storeOddsSnapshot } from '../services/db';

export const router = Router();

const normalizeQuery = (
  query: Request['query'],
): Record<string, string> => {
  const normalized: Record<string, string> = {};
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) return;
    if (Array.isArray(value)) {
      normalized[key] = value[0] !== undefined ? String(value[0]) : '';
      return;
    }
    normalized[key] = String(value);
  });
  return normalized;
};

router.get('/status', async (_req: Request, res: Response) => {
  try {
    const data = await apiFootball.status();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/fixtures/live', async (_req: Request, res: Response) => {
  try {
    const data = await apiFootball.fixturesLive();
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/odds/live', async (_req: Request, res: Response) => {
  try {
    const data = await apiFootball.oddsLive();
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
    const data = await fetchApi('/leagues', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/teams', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/teams', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/standings', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/standings', params, 60);
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
    const data = await fetchApi('/odds/bets', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/odds/bookmakers', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds/bookmakers', params, 60);
    res.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
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

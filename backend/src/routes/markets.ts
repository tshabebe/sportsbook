import { Router, Request, Response } from 'express';
import { fetchApi } from '../services/apiFootball';
import { normalizeMarkets } from '../services/markets';

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

router.get('/', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds', params, 60);
    const response = Array.isArray(data.response) ? data.response : [];
    res.json({
      ...data,
      response: normalizeMarkets(response),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/live', async (_req: Request, res: Response) => {
  try {
    const data = await fetchApi('/odds/live', undefined, 60);
    const response = Array.isArray(data.response) ? data.response : [];
    res.json({
      ...data,
      response: normalizeMarkets(response),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.get('/:fixtureId', async (req: Request, res: Response) => {
  try {
    const fixtureId = String(req.params.fixtureId);
    const data = await fetchApi('/odds', { fixture: fixtureId }, 60);
    const response = Array.isArray(data.response) ? data.response : [];
    res.json({
      ...data,
      response: normalizeMarkets(response),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

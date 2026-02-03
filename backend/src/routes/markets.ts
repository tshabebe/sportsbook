import { Router, Request, Response } from 'express';
import { fetchApi } from '../services/apiFootball';
import { normalizeMarkets } from '../services/markets';
import { normalizeQuery } from './utils';
import { storeOddsSnapshot } from '../services/db';

export const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const params = normalizeQuery(req.query);
    const data = await fetchApi('/odds', params, 60);
    const response = Array.isArray(data.response) ? data.response : [];
    storeOddsSnapshot('api-football:odds', data).catch((err) => {
      console.error('Failed to store odds snapshot', err);
    });
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
    const data = await fetchApi('/odds/live', undefined, 15);
    const response = Array.isArray(data.response) ? data.response : [];
    storeOddsSnapshot('api-football:odds/live', data).catch((err) => {
      console.error('Failed to store odds snapshot', err);
    });
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
    storeOddsSnapshot(`api-football:odds:fixture:${fixtureId}`, data).catch((err) => {
      console.error('Failed to store odds snapshot', err);
    });
    res.json({
      ...data,
      response: normalizeMarkets(response),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

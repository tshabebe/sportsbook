import { Router, Request, Response } from 'express';
import { apiFootball } from '../services/apiFootball';
import { normalizeQuery } from './utils';
import { asyncHandler } from '../middleware/asyncHandler';

export const router = Router();

// Generic Proxy Handler
const handleProxy = (path: string) =>
  asyncHandler(async (req: Request, res: Response) => {
    const params = normalizeQuery(req.query);
    const data = await apiFootball.proxy(path, params);
    res.json(data);
  });

// --- Custom Optimized Routes ---

router.get(
  '/leagues/popular',
  asyncHandler(async (_req: Request, res: Response) => {
    // Optimized: Use hardcoded IDs to avoid 12 parallel API search calls (Rate Limit protection)
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
  }),
);

// --- Proxy Routes (Mapped 1:1 to API-Football) ---

router.get('/status', handleProxy('/status'));

// Fixtures
router.get('/fixtures', handleProxy('/fixtures'));
router.get('/fixtures/live', handleProxy('/fixtures')); // Frontend can pass live=all
router.get('/fixtures/rounds', handleProxy('/fixtures/rounds'));
router.get('/fixtures/events', handleProxy('/fixtures/events'));
router.get('/fixtures/lineups', handleProxy('/fixtures/lineups'));
router.get('/fixtures/statistics', handleProxy('/fixtures/statistics'));
router.get('/fixtures/headtohead', handleProxy('/fixtures/headtohead'));
router.get('/fixtures/players', handleProxy('/fixtures/players'));

// Odds
router.get('/odds', handleProxy('/odds'));
router.get('/odds/live', handleProxy('/odds/live'));
router.get('/odds/live/bets', handleProxy('/odds/live/bets'));
router.get('/odds/mapping', handleProxy('/odds/mapping'));
router.get('/odds/bookmakers', handleProxy('/odds/bookmakers'));

// Entities
router.get('/leagues', handleProxy('/leagues'));
router.get('/teams', handleProxy('/teams'));
router.get('/standings', handleProxy('/standings'));
router.get('/predictions', handleProxy('/predictions'));
router.get('/injuries', handleProxy('/injuries'));
router.get('/timezone', handleProxy('/timezone'));
router.get('/countries', handleProxy('/countries'));
router.get('/venues', handleProxy('/venues'));

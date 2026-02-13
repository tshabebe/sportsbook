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

const POPULAR_LEAGUES = [
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 2, name: 'UEFA Champions League', country: 'World' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 45, name: 'FA Cup', country: 'England' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 88, name: 'Eredivisie', country: 'Netherlands' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 40, name: 'Championship', country: 'England' },
];

// --- Custom Optimized Routes ---

// --- Proxy Routes (Mapped 1:1 to API-Football) ---


router.get('/status', handleProxy('/status'));

router.get(
  '/leagues/popular',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      ok: true,
      leagues: POPULAR_LEAGUES.map((league) => ({
        ...league,
        logo: `https://media.api-sports.io/football/leagues/${league.id}.png`,
      })),
    });
  }),
);

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
router.get('/odds/bets', handleProxy('/odds/bets'));
router.get('/odds/mapping', handleProxy('/odds/mapping'));
router.get('/odds/bookmakers', handleProxy('/odds/bookmakers'));

// Entities
router.get('/leagues', handleProxy('/leagues'));
router.get('/teams', handleProxy('/teams'));
router.get('/standings', handleProxy('/standings'));
router.get('/predictions', handleProxy('/predictions'));
router.get('/injuries', handleProxy('/injuries'));
router.get('/countries', handleProxy('/countries'));
router.get('/venues', handleProxy('/venues'));

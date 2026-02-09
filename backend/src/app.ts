import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { router as footballRouter } from './routes/football';
import { router as betsRouter } from './routes/bets';
import { router as walletRouter } from './routes/wallet';
import { router as retailRouter } from './routes/retail';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { cacheHealth } from './services/cache';
import { dbHealth } from './db';
import { asyncHandler } from './middleware/asyncHandler';

export const createApp = (): Express => {
  const app: Express = express();

  // Middleware
  app.use(cors());
  app.use(requestLogger);
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check route
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      ok: true,
      status: 'ok',
      service: 'sportsbook-backend',
      timestamp: new Date().toISOString(),
    });
  });

  app.get(
    '/ready',
    asyncHandler(async (_req: Request, res: Response) => {
      const [cache, database] = await Promise.all([cacheHealth(), dbHealth()]);
      const ok = cache.ok && database.ok;

      res.status(ok ? 200 : 503).json({
        ok,
        status: ok ? 'ready' : 'degraded',
        timestamp: new Date().toISOString(),
        dependencies: {
          cache,
          database,
        },
      });
    }),
  );

  // API routes
  app.get('/api', (req: Request, res: Response) => {
    res.json({ message: 'Welcome to the Sportsbook API' });
  });

  app.use('/api/football', footballRouter);
  app.use('/api', betsRouter);
  app.use('/api/wallet', walletRouter);
  app.use('/api/retail', retailRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

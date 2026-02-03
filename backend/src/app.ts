import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { router as footballRouter } from './routes/football';
import { router as marketsRouter } from './routes/markets';
import { router as betsRouter } from './routes/bets';
import { router as walletRouter } from './routes/wallet';

export const createApp = (): Express => {
  const app: Express = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health check route
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.get('/api', (req: Request, res: Response) => {
    res.json({ message: 'Welcome to the Sportsbook API' });
  });

  app.use('/api/football', footballRouter);
  app.use('/api/markets', marketsRouter);
  app.use('/api', betsRouter);
  app.use('/api/wallet', walletRouter);

  return app;
};

import path from 'path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRun =
  process.env.RUN_LIVE_TESTS === '1' && Boolean(process.env.API_FOOTBALL_KEY);

describe('api-football proxy live integration', () => {
  const leagueId = process.env.TEST_LEAGUE_ID ?? '';
  const season = process.env.TEST_SEASON ?? '';
  const date = process.env.TEST_DATE ?? '';
  const fixtureId = process.env.TEST_FIXTURE_ID ?? '';

  it.runIf(shouldRun)('hits live status with real api key', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/football/status');
    expect(response.status).toBe(200);
    expect(response.body.response?.account).toBeTruthy();
    expect(response.body.response?.subscription).toBeTruthy();
  });

  it.runIf(shouldRun)('hits fixtures live', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/football/fixtures/live');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
  });

  it.runIf(shouldRun)('hits odds live', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/football/odds/live');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
  });

  it.runIf(shouldRun)('hits leagues list', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/football/leagues');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
  });

  it
    .runIf(shouldRun && Boolean(leagueId) && Boolean(season))(
      'hits standings for league+season',
      async () => {
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const response = await request(app).get(
          `/api/football/standings?league=${leagueId}&season=${season}`,
        );
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
      },
    );

  it
    .runIf(shouldRun && Boolean(leagueId) && Boolean(season))(
      'hits teams for league+season',
      async () => {
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const response = await request(app).get(
          `/api/football/teams?league=${leagueId}&season=${season}`,
        );
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
      },
    );

  it
    .runIf(shouldRun && Boolean(date))(
      'hits fixtures for date',
      async () => {
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const response = await request(app).get(
          `/api/football/fixtures?date=${date}`,
        );
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
      },
    );

  it
    .runIf(shouldRun && Boolean(leagueId) && Boolean(season))(
      'hits pre-match odds for league+season',
      async () => {
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const response = await request(app).get(
          `/api/football/odds?league=${leagueId}&season=${season}`,
        );
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('results');
      },
    );

  it.runIf(shouldRun)('hits live odds bets list', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/football/odds/live/bets');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
  });

  it.runIf(shouldRun)('hits odds bookmakers list', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/football/odds/bookmakers');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
  });

  it
    .runIf(shouldRun && Boolean(fixtureId))('hits fixture events', async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const response = await request(app).get(
        `/api/football/fixtures/events?fixture=${fixtureId}`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
    });

  it
    .runIf(shouldRun && Boolean(fixtureId))('hits fixture lineups', async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const response = await request(app).get(
        `/api/football/fixtures/lineups?fixture=${fixtureId}`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
    });

  it
    .runIf(shouldRun && Boolean(fixtureId))('hits fixture statistics', async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const response = await request(app).get(
        `/api/football/fixtures/statistics?fixture=${fixtureId}`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
    });

  it
    .runIf(shouldRun && Boolean(fixtureId))('hits predictions', async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const response = await request(app).get(
        `/api/football/predictions?fixture=${fixtureId}`,
      );
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
    });
});


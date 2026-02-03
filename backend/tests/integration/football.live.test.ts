import path from 'path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRun =
  process.env.RUN_LIVE_TESTS === '1' && Boolean(process.env.API_FOOTBALL_KEY);

describe('api-football live integration', () => {
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

  it.runIf(shouldRun)('hits odds bets list', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/football/odds/bets');
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

  it
    .runIf(shouldRun && Boolean(fixtureId))('hits markets for fixture', async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const response = await request(app).get(`/api/markets/${fixtureId}`);
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('results');
    });

  it.runIf(shouldRun)('hits markets live', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/markets/live');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
  });

  it.runIf(shouldRun)('hits markets list', async () => {
    const { createApp } = await import('../../src/app');
    const app = createApp();

    const response = await request(app).get('/api/markets');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('results');
  });

  it
    .runIf(shouldRun && Boolean(fixtureId))(
      'validates and places betslip',
      async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const oddsResponse = await request(app).get(
        `/api/football/odds?fixture=${fixtureId}`,
      );
      expect(oddsResponse.status).toBe(200);

      const oddsItems = oddsResponse.body?.response ?? [];
      const firstItem = Array.isArray(oddsItems) ? oddsItems[0] : null;
      const firstBet = firstItem?.bets?.[0];
      const firstValue = firstBet?.values?.[0];
      if (!firstItem || !firstBet || !firstValue) {
        expect(Array.isArray(oddsItems)).toBe(true);
        return;
      }

      const payload = {
        selections: [
          {
            fixtureId: Number(fixtureId),
            betId: firstBet?.id ?? 1,
            value: String(firstValue?.value ?? 'Home'),
            odd: Number(firstValue?.odd ?? 1),
            bookmakerId: firstItem?.bookmaker?.id,
          },
        ],
        stake: 10,
      };

      const validateResponse = await request(app)
        .post('/api/betslip/validate')
        .send(payload);
      expect(validateResponse.status).toBe(200);

      const placeResponse = await request(app)
        .post('/api/betslip/place')
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
        .send(payload);
      expect(placeResponse.status).toBe(200);
      expect(placeResponse.body.ok).toBe(true);

      const betId = placeResponse.body.bet?.id;
      const listResponse = await request(app).get('/api/bets');
      expect(listResponse.status).toBe(200);

      if (betId) {
        const getResponse = await request(app).get(`/api/bets/${betId}`);
        expect(getResponse.status).toBe(200);
        const settleResponse = await request(app)
          .post(`/api/bets/${betId}/settle`)
          .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
          .send({ result: 'won', payout: 2 });
        expect(settleResponse.status).toBe(200);
        expect(settleResponse.body.ok).toBe(true);
      }
      },
      15000,
    );
});

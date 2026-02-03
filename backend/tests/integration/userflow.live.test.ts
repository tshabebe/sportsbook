import path from 'path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRun =
  process.env.RUN_LIVE_TESTS === '1' &&
  Boolean(process.env.TEST_TOKEN) &&
  Boolean(process.env.TEST_FIXTURE_ID);

describe('user flow live integration', () => {
  it.runIf(shouldRun)(
    'profile → validate → place → settle',
    async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const profileResponse = await request(app)
        .get('/api/wallet/profile')
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`);
      expect(profileResponse.status).toBe(200);
      const userData = profileResponse.body.data?.userData || profileResponse.body.data;
      const username = userData?.username || userData?.userName || 'user';
      const balanceBefore = Number(userData?.balance ?? 0);

      console.log('[userflow] profile', { username, balanceBefore });

      const oddsResponse = await request(app).get(
        `/api/football/odds?fixture=${process.env.TEST_FIXTURE_ID}`,
      );
      expect(oddsResponse.status).toBe(200);
      const oddsItems = oddsResponse.body?.response ?? [];
      const firstItem = Array.isArray(oddsItems) ? oddsItems[0] : null;
      const firstBet = firstItem?.bets?.[0];
      const firstValue = firstBet?.values?.[0];
      if (!firstItem || !firstBet || !firstValue) {
        console.log('[userflow] no odds available for fixture');
        return;
      }

      const payload = {
        selections: [
          {
            fixtureId: Number(process.env.TEST_FIXTURE_ID),
            betId: firstBet?.id ?? 1,
            value: String(firstValue?.value ?? 'Home'),
            odd: Number(firstValue?.odd ?? 1),
            bookmakerId: firstItem?.bookmaker?.id,
          },
        ],
        stake: 2,
      };

      const validateResponse = await request(app)
        .post('/api/betslip/validate')
        .send(payload);
      expect(validateResponse.status).toBe(200);
      console.log('[userflow] validate', validateResponse.body);

      const placeResponse = await request(app)
        .post('/api/betslip/place')
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
        .send(payload);
      expect(placeResponse.status).toBe(200);
      console.log('[userflow] placed', placeResponse.body?.bet?.id);

      const betId = placeResponse.body.bet?.id;
      expect(betId).toBeTruthy();

      const settleResponse = await request(app)
        .post(`/api/bets/${betId}/settle`)
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
        .send({ result: 'won', payout: 2 });
      expect(settleResponse.status).toBe(200);
      console.log('[userflow] settled', settleResponse.body?.bet?.status);

      const profileAfter = await request(app)
        .get('/api/wallet/profile')
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`);
      expect(profileAfter.status).toBe(200);
      const userDataAfter = profileAfter.body.data?.userData || profileAfter.body.data;
      const balanceAfter = Number(userDataAfter?.balance ?? 0);

      console.log('[userflow] profile after', {
        username,
        balanceAfter,
      });
    },
    20000,
  );
});

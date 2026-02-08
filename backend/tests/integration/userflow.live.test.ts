import path from 'path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRun =
  process.env.RUN_LIVE_TESTS === '1' && Boolean(process.env.TEST_TOKEN);

describe('user flow live integration', () => {
  it.runIf(shouldRun)(
    'ui flow → validate → place → settle',
    async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const requiredGet = async (url: string) => {
        const response = await request(app).get(url);
        expect(response.status).toBe(200);
        return response;
      };

      const profileResponse = await request(app)
        .get('/api/wallet/profile')
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`);
      expect(profileResponse.status).toBe(200);
      const userData = profileResponse.body.data?.userData || profileResponse.body.data;
      const username = userData?.username || userData?.userName || 'user';
      const balanceBefore = Number(userData?.balance ?? 0);

      console.log('[userflow] profile', { username, balanceBefore });

      // 1) Home / Popular Leagues
      const popular = await requiredGet('/api/football/leagues/popular');
      const popularLeagues = popular.body?.leagues ?? [];
      const firstLeague = Array.isArray(popularLeagues) ? popularLeagues.find((l: any) => l?.id) : null;
      const leagueId = Number(firstLeague?.id ?? process.env.TEST_LEAGUE_ID ?? 39);
      const season = Number(process.env.TEST_SEASON ?? 2024);

      // 2) League Page (fixtures list + standings + rounds)
      const fixturesResponse = await requiredGet(
        `/api/football/fixtures?league=${leagueId}&season=${season}&next=20`,
      );
      await requiredGet(`/api/football/standings?league=${leagueId}&season=${season}`);
      await requiredGet(`/api/football/fixtures/rounds?league=${leagueId}&season=${season}`);

      const fixturesList = fixturesResponse.body?.response ?? [];
      const firstFixture = Array.isArray(fixturesList) ? fixturesList[0] : null;

      let oddsResponse;
      let fixtureId: number | null = Number(firstFixture?.fixture?.id);

      // 3) Match Card (quick odds)
      if (Number.isFinite(fixtureId)) {
        const res = await request(app).get(`/api/football/odds?fixture=${fixtureId}`);
        if (res.status === 200 && Array.isArray(res.body?.response) && res.body.response.length > 0) {
          oddsResponse = res;
        }
      }

      if (!oddsResponse || !fixtureId) {
        console.log('[userflow] no fixtures with actual odds');
        return;
      }

      // 4) Match Detail Page (pre‑match)
      const fixtureDetails = await requiredGet(`/api/football/fixtures?ids=${fixtureId}`);
      const fixtureDetailItem = Array.isArray(fixtureDetails.body?.response)
        ? fixtureDetails.body.response[0]
        : null;
      const h2hHome = Number(fixtureDetailItem?.teams?.home?.id);
      const h2hAway = Number(fixtureDetailItem?.teams?.away?.id);
      if (Number.isFinite(h2hHome) && Number.isFinite(h2hAway)) {
        await requiredGet(`/api/football/fixtures/headtohead?h2h=${h2hHome}-${h2hAway}`);
      }
      const teamId = Number(fixtureDetailItem?.teams?.home?.id);
      if (Number.isFinite(teamId)) {
        await requiredGet(`/api/football/injuries?league=${leagueId}&season=${season}&team=${teamId}`);
      }
      await requiredGet(`/api/football/fixtures/lineups?fixture=${fixtureId}`);
      await requiredGet(`/api/football/predictions?fixture=${fixtureId}`);

      // 5) Live Tab
      await requiredGet('/api/football/fixtures/live');
      await requiredGet('/api/football/odds/live');

      // 6) Live Match Page (stats/events)
      await requiredGet(`/api/football/fixtures/statistics?fixture=${fixtureId}`);
      await requiredGet(`/api/football/fixtures/events?fixture=${fixtureId}`);

      const oddsItems = oddsResponse.body?.response ?? [];
      const firstItem = Array.isArray(oddsItems) ? oddsItems[0] : null;
      const bookmakers = firstItem?.bookmakers ?? [];
      const bets = bookmakers.flatMap((b: any) => b?.bets ?? []);
      if (!firstItem || !Array.isArray(bets) || bets.length === 0) {
        console.log('[userflow] no odds available for selected fixture');
        return;
      }

      const pickBet = (names: string[]) =>
        bets.find((b: any) =>
          names.some((name) =>
            String(b?.name || '').toLowerCase().includes(name.toLowerCase()),
          ),
        );

      const selectedBet =
        pickBet(['match winner', 'winner']) ||
        pickBet(['over/under', 'over under']) ||
        pickBet(['both teams to score', 'btts']) ||
        bets[0];
      const selectedValue = selectedBet?.values?.[0];
      const selectedBookmaker = bookmakers.find((b: any) =>
        (b?.bets ?? []).some((bet: any) => bet?.id === selectedBet?.id),
      );

      if (!selectedBet || !selectedValue) {
        console.log('[userflow] no valid market selection');
        return;
      }

      const payload = {
        selections: [
          {
            fixtureId,
            betId: selectedBet?.id ?? 1,
            value: String(selectedValue?.value ?? 'Home'),
            odd: Number(selectedValue?.odd ?? 1),
            handicap: selectedValue?.handicap,
            bookmakerId: selectedBookmaker?.id ?? firstItem?.bookmaker?.id,
          },
        ],
        stake: 2,
      };

      const validateResponse = await request(app)
        .post('/api/betslip/validate')
        .send(payload);
      expect(validateResponse.status).toBe(200);
      console.log('[userflow] validate', JSON.stringify(validateResponse.body));
      if (!validateResponse.body?.ok) {
        const firstError = validateResponse.body?.results?.[0]?.error?.code;
        if (firstError === 'ODDS_CHANGED' && fixtureId) {
          await request(app).get(`/api/football/odds?fixture=${fixtureId}`);
          const retry = await request(app)
            .post('/api/betslip/validate')
            .send(payload);
          console.log('[userflow] validate retry', JSON.stringify(retry.body));
          if (!retry.body?.ok) {
            console.log('[userflow] validation failed');
            return;
          }
        } else {
          console.log('[userflow] validation failed');
          return;
        }
      }

      const placeResponse = await request(app)
        .post('/api/betslip/place')
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
        .send(payload);
      console.log('[userflow] place response', placeResponse.status);
      if (placeResponse.status !== 200) {
        console.log('[userflow] place failed', placeResponse.status, placeResponse.body);
        return;
      }
      expect(placeResponse.status).toBe(200);
      console.log('[userflow] placed', placeResponse.body?.bet?.id);

      const betId = placeResponse.body.bet?.id;
      expect(betId).toBeTruthy();

      const settleResponse = await request(app)
        .post(`/api/bets/${betId}/settle`)
        .set('Authorization', `Bearer ${process.env.TEST_TOKEN}`)
        .send({ result: 'won', payout: 2 });
      console.log('[userflow] settle response', settleResponse.status);
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
    60000,
  );
});

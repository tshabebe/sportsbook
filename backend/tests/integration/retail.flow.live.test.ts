import path from 'path';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const shouldRunRetailFlow =
  process.env.RUN_LIVE_TESTS === '1' &&
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.RETAIL_AUTH_SECRET ?? process.env.JWT_SECRET);

const shouldRunRetailOddsValidation =
  process.env.RUN_LIVE_TESTS === '1' &&
  Boolean(process.env.API_FOOTBALL_KEY) &&
  Boolean(process.env.TEST_LEAGUE_ID) &&
  Boolean(process.env.TEST_SEASON);

const toSelectionFromOddsItem = (item: any) => {
  const bookmaker = item?.bookmakers?.[0];
  const bet = bookmaker?.bets?.[0];
  const value = bet?.values?.[0];
  if (!bookmaker || !bet || !value) return null;
  return {
    fixtureId: Number(item?.fixture?.id),
    betId: bet?.id ?? 1,
    value: String(value?.value ?? 'Home'),
    odd: Number(value?.odd ?? 1),
    bookmakerId: bookmaker?.id,
    handicap: value?.handicap,
  };
};

describe('retail ticket flow live integration', () => {
  const leagueId = process.env.TEST_LEAGUE_ID ?? '';
  const season = process.env.TEST_SEASON ?? '';

  it
    .runIf(shouldRunRetailFlow)(
      'supports login, claim ownership, payout access control, and idempotent payout',
      async () => {
        const [{ createApp }, { db }, schema, auth] = await Promise.all([
          import('../../src/app'),
          import('../../src/db'),
          import('../../src/db/schema'),
          import('../../src/services/retailAuth'),
        ]);

        const app = createApp();
        const now = Date.now();

        const retailerOnePassword = `RetailerOne-${now}`;
        const retailerTwoPassword = `RetailerTwo-${now}`;
        const retailerOneUsername = `retailer_one_${now}`;
        const retailerTwoUsername = `retailer_two_${now}`;

        const [retailerOne] = await db
          .insert(schema.retailers)
          .values(
            schema.retailersInsertSchema.parse({
              name: 'Retailer One',
              username: retailerOneUsername,
              passwordHash: auth.createRetailerPasswordHash(retailerOnePassword),
            }),
          )
          .returning();
        const [retailerTwo] = await db
          .insert(schema.retailers)
          .values(
            schema.retailersInsertSchema.parse({
              name: 'Retailer Two',
              username: retailerTwoUsername,
              passwordHash: auth.createRetailerPasswordHash(retailerTwoPassword),
            }),
          )
          .returning();

        const openTicketId = `TK-OPEN-${now}`;
        const payoutTicketId = `TK-PAYOUT-${now}`;

        const [openBet] = await db
          .insert(schema.bets)
          .values(
            schema.betsInsertSchema.parse({
              betRef: `bet_open_${now}`,
              channel: 'online_retail_ticket',
              ticketId: openTicketId,
              stake: '10.00',
              status: 'pending',
            }),
          )
          .returning();
        const [wonBet] = await db
          .insert(schema.bets)
          .values(
            schema.betsInsertSchema.parse({
              betRef: `bet_won_${now}`,
              channel: 'online_retail_ticket',
              ticketId: payoutTicketId,
              stake: '10.00',
              status: 'won',
            }),
          )
          .returning();

        await db.insert(schema.retailTickets).values(
          schema.retailTicketsInsertSchema.parse({
            ticketId: openTicketId,
            betId: openBet.id,
            status: 'open',
          }),
        );

        await db.insert(schema.retailTickets).values(
          schema.retailTicketsInsertSchema.parse({
            ticketId: payoutTicketId,
            betId: wonBet.id,
            status: 'settled_won_unpaid',
            claimedByRetailerId: retailerOne.id,
            claimedAt: new Date(),
            payoutAmount: '25.00',
          }),
        );

        const loginOne = await request(app).post('/api/retail/auth/login').send({
          username: retailerOneUsername,
          password: retailerOnePassword,
        });
        expect(loginOne.status).toBe(200);
        expect(loginOne.body.ok).toBe(true);
        const tokenOne = loginOne.body.token as string;
        expect(tokenOne).toBeTruthy();

        const loginTwo = await request(app).post('/api/retail/auth/login').send({
          username: retailerTwoUsername,
          password: retailerTwoPassword,
        });
        expect(loginTwo.status).toBe(200);
        const tokenTwo = loginTwo.body.token as string;

        const lookupOpen = await request(app).get(`/api/retail/tickets/${openTicketId}`);
        expect(lookupOpen.status).toBe(200);
        expect(lookupOpen.body.ticket.status).toBe('open');

        const claimByOwner = await request(app)
          .post(`/api/retail/tickets/${openTicketId}/claim`)
          .set('Authorization', `Bearer ${tokenOne}`);
        expect(claimByOwner.status).toBe(200);
        expect(claimByOwner.body.ticket.status).toBe('claimed');
        expect(claimByOwner.body.ticket.claimedByRetailerId).toBe(retailerOne.id);

        const claimByOtherRetailer = await request(app)
          .post(`/api/retail/tickets/${openTicketId}/claim`)
          .set('Authorization', `Bearer ${tokenTwo}`);
        expect(claimByOtherRetailer.status).toBe(409);

        const payoutByNonOwner = await request(app)
          .post(`/api/retail/tickets/${payoutTicketId}/payout`)
          .set('Authorization', `Bearer ${tokenTwo}`)
          .send({ payoutReference: `payout_non_owner_${now}` });
        expect(payoutByNonOwner.status).toBe(403);

        const payoutByOwner = await request(app)
          .post(`/api/retail/tickets/${payoutTicketId}/payout`)
          .set('Authorization', `Bearer ${tokenOne}`)
          .send({ payoutReference: `payout_owner_${now}` });
        expect(payoutByOwner.status).toBe(200);
        expect(payoutByOwner.body.ok).toBe(true);
        expect(payoutByOwner.body.ticket.status).toBe('paid');

        const payoutAgainIdempotent = await request(app)
          .post(`/api/retail/tickets/${payoutTicketId}/payout`)
          .set('Authorization', `Bearer ${tokenOne}`)
          .send({ payoutReference: `payout_owner_${now}` });
        expect(payoutAgainIdempotent.status).toBe(200);
        expect(payoutAgainIdempotent.body.ok).toBe(true);
        expect(payoutAgainIdempotent.body.idempotent).toBe(true);
      },
      30000,
    );

  it
    .runIf(shouldRunRetailOddsValidation)(
      'rejects historical odds for retail ticket placement',
      async () => {
        const { createApp } = await import('../../src/app');
        const app = createApp();

        const oddsResponse = await request(app).get(
          `/api/football/odds?league=${leagueId}&season=${season}&bookmaker=8&page=1`,
        );
        expect(oddsResponse.status).toBe(200);

        const oddsItems = Array.isArray(oddsResponse.body?.response)
          ? oddsResponse.body.response
          : [];
        const now = Date.now();
        const historicalItem = oddsItems.find((item: any) => {
          const timestamp = new Date(item?.fixture?.date ?? 0).getTime();
          return Number.isFinite(timestamp) && timestamp < now;
        });

        if (!historicalItem) {
          expect(Array.isArray(oddsItems)).toBe(true);
          return;
        }

        const selection = toSelectionFromOddsItem(historicalItem);
        if (!selection || !Number.isFinite(selection.fixtureId)) {
          expect(selection).toBeTruthy();
          return;
        }

        const placeRetailResponse = await request(app)
          .post('/api/betslip/place-retail')
          .send({
            selections: [selection],
            stake: 10,
          });
        expect(placeRetailResponse.status).toBe(409);
        expect(placeRetailResponse.body.ok).toBe(false);
      },
      20000,
    );

  it.runIf(shouldRunRetailOddsValidation)(
    'rejects live fixtures for retail ticket placement',
    async () => {
      const { createApp } = await import('../../src/app');
      const app = createApp();

      const liveFixturesResponse = await request(app).get('/api/football/fixtures/live');
      expect(liveFixturesResponse.status).toBe(200);
      const liveFixtures = Array.isArray(liveFixturesResponse.body?.response)
        ? liveFixturesResponse.body.response
        : [];

      if (liveFixtures.length === 0) {
        expect(liveFixtures).toEqual([]);
        return;
      }

      const liveFixtureId = Number(liveFixtures[0]?.fixture?.id);
      if (!Number.isFinite(liveFixtureId)) {
        expect(Number.isFinite(liveFixtureId)).toBe(true);
        return;
      }

      const liveOddsResponse = await request(app).get('/api/football/odds/live');
      expect(liveOddsResponse.status).toBe(200);
      const liveOddsItems = Array.isArray(liveOddsResponse.body?.response)
        ? liveOddsResponse.body.response
        : [];

      const liveOddsItem =
        liveOddsItems.find((item: any) => Number(item?.fixture?.id) === liveFixtureId) ??
        liveOddsItems[0];

      if (!liveOddsItem) {
        expect(Array.isArray(liveOddsItems)).toBe(true);
        return;
      }

      const selection = toSelectionFromOddsItem({
        ...liveOddsItem,
        fixture: { ...(liveOddsItem.fixture ?? {}), id: liveFixtureId },
      });
      if (!selection) {
        expect(selection).toBeTruthy();
        return;
      }

      const placeRetailResponse = await request(app)
        .post('/api/betslip/place-retail')
        .send({
          selections: [selection],
          stake: 10,
        });

      expect(placeRetailResponse.status).toBe(409);
      expect(placeRetailResponse.body.ok).toBe(false);
    },
    20000,
  );
});


import { Router, Request, Response } from 'express';
import { betSlipSchema, settleBetSchema } from '../validation/bets';
import type { ApiBetSlipInput } from '../validation/bets';
import {
  createBetWithSelections,
  getBetWithSelections,
  getExposureForOutcome,
  listBetsWithSelections,
  listPendingBetsByFixture,
  updateBetSettlement,
} from '../services/db';
import { walletClient } from '../services/walletClient';
import { config } from '../services/config';
import { checkMaxPayout, checkOddsRange, checkStake } from '../services/risk';
import { apiFootball } from '../services/apiFootball';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/http';
import { requireBearerToken } from './utils';

export const router = Router();

const extractSelectionsFromItem = (item: any) => {
  const selections: Array<{
    betId?: number | string;
    value: string;
    odd: number;
    handicap?: string;
    suspended?: boolean;
    bookmakerId?: number;
  }> = [];

  if (Array.isArray(item?.bookmakers)) {
    for (const bookmaker of item.bookmakers) {
      const bookmakerId = bookmaker?.id;
      const bets = bookmaker?.bets ?? [];
      for (const bet of bets) {
        const values = bet?.values ?? [];
        for (const value of values) {
          if (value?.value && value?.odd) {
            selections.push({
              betId: bet?.id,
              value: String(value.value),
              odd: Number(value.odd),
              handicap: value?.handicap !== undefined ? String(value.handicap) : undefined,
              suspended: Boolean(value?.suspended),
              bookmakerId,
            });
          }
        }
      }
    }
  }

  if (Array.isArray(item?.odds)) {
    for (const bet of item.odds) {
      const values = bet?.values ?? [];
      for (const value of values) {
        if (value?.value && value?.odd) {
          selections.push({
            betId: bet?.id,
            value: String(value.value),
            odd: Number(value.odd),
            handicap: value?.handicap !== undefined ? String(value.handicap) : undefined,
            suspended: Boolean(value?.suspended),
          });
        }
      }
    }
  }

  return selections;
};

const normalizeHandicap = (value?: string | number) =>
  value === undefined || value === null ? undefined : String(value);

const oddsEqual = (a?: number, b?: number) => {
  if (a === undefined || b === undefined) return false;
  return Math.abs(Number(a) - Number(b)) <= 0.001;
};

const extractSelectionDetailsFromSnapshot = (
  snapshot: unknown,
  selection: {
    betId?: number | string;
    value: string;
    odd: number;
    bookmakerId?: number;
    handicap?: string | number;
  },
  fixtureId: number,
): { found: boolean; suspended?: boolean } => {
  if (!snapshot || typeof snapshot !== 'object') return { found: false };
  const response = (snapshot as { response?: unknown }).response;
  if (!Array.isArray(response)) return { found: false };
  const targetHandicap = normalizeHandicap(selection.handicap);
  const fixtureItems = response.filter(
    (item) => Number(item?.fixture?.id) === Number(fixtureId),
  );
  for (const item of fixtureItems) {
    const selections = extractSelectionsFromItem(item);
    for (const s of selections) {
      if (selection.bookmakerId && s.bookmakerId && Number(s.bookmakerId) !== Number(selection.bookmakerId)) {
        continue;
      }
      if (selection.betId && s.betId && String(s.betId) !== String(selection.betId)) {
        continue;
      }
      if (targetHandicap && normalizeHandicap(s.handicap) !== targetHandicap) {
        continue;
      }
      if (
        s.value.toLowerCase() === selection.value.toLowerCase() &&
        oddsEqual(Number(s.odd), Number(selection.odd))
      ) {
        return { found: true, suspended: Boolean(s.suspended) };
      }
    }
  }
  return { found: false };
};

router.post(
  '/betslip/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = betSlipSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_BETSLIP', 'Invalid betslip', parsed.error.flatten());
    }
    const slip: ApiBetSlipInput = parsed.data;

    const stakeCheck = checkStake(slip.stake);
    if (!stakeCheck.ok) {
      res.json({ ok: false, error: stakeCheck });
      return;
    }
    const oddsCheck = checkOddsRange(slip.selections);
    if (!oddsCheck.ok) {
      res.json({ ok: false, error: oddsCheck });
      return;
    }
    const payoutCheck = checkMaxPayout(slip.stake, slip.selections);
    if (!payoutCheck.ok) {
      res.json({ ok: false, error: payoutCheck });
      return;
    }

    const results = await Promise.all(
      slip.selections.map(async (selection) => {
        // Validation now checks against the latest cached/live odds via the proxy
        const oddsData = await apiFootball.proxy('/odds', { fixture: selection.fixtureId });

        if (!oddsData || !oddsData.response || !oddsData.response.length) {
          // If we can't find odds, we check if it's because the game started or just missing data
          // For simplification, we might fail here or check fixture status
          return {
            selection,
            ok: false,
            error: { code: 'ODDS_UNAVAILABLE', message: 'Odds currently unavailable for this fixture' },
          };
        }

        const oddsResponse = oddsData.response[0]; // Assuming one fixture per response when queried by ID

        // Validate fixture status (In-Play check)
        // We might need to fetch fixture status separately if not included in odds, 
        // but typically odds endpoint doesn't return status. 
        // Ideally, we should check /fixtures status here too.
        // For this streamlined version, we will assume if odds are live/available, it's valid, 
        // but let's do a quick fixture status check to prevent betting on finished games if possible.
        // Optimization: The proxy caches /fixtures quickly.
        const fixtureData = await apiFootball.proxy('/fixtures', { id: selection.fixtureId });
        const fixtureStatus = fixtureData.response?.[0]?.fixture?.status?.short;
        const inPlayStatuses = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE', 'FT', 'AET', 'PEN']);

        // If status is FINISHED or IN_PLAY (and this is a pre-match validator), reject.
        // Note: The previous logic checked 'LIVE' etc.
        if (fixtureStatus && inPlayStatuses.has(fixtureStatus)) {
          return {
            selection,
            ok: false,
            error: { code: 'IN_PLAY', message: 'Fixture is in play or finished' },
          };
        }

        const detail = extractSelectionDetailsFromSnapshot(
          oddsData, // passing the full response object which matches the "snapshot" structure
          selection,
          selection.fixtureId,
        );

        if (!detail.found) {
          return {
            selection,
            ok: false,
            error: { code: 'ODDS_CHANGED', message: 'Odds changed or selection no longer available' },
          };
        }
        if (detail.suspended) {
          return {
            selection,
            ok: false,
            error: { code: 'MARKET_SUSPENDED', message: 'Market suspended' },
          };
        }
        const exposure = await getExposureForOutcome(
          selection.fixtureId,
          selection.value,
          selection.betId,
          selection.handicap,
          selection.bookmakerId,
        );
        const projected = exposure + slip.stake * selection.odd;
        if (projected > config.risk.maxExposurePerOutcome) {
          return {
            selection,
            ok: false,
            error: {
              code: 'MAX_EXPOSURE',
              message: 'Exposure limit reached for this outcome',
            },
          };
        }
        return { selection, ok: true };
      }),
    );
    const ok = results.every((r) => r.ok);
    res.json({ ok, results });
  }),
);

router.post(
  '/betslip/place',
  asyncHandler(async (req: Request, res: Response) => {
    const token = requireBearerToken(req);
    const parsed = betSlipSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_BETSLIP', 'Invalid betslip', parsed.error.flatten());
    }
    const slip: ApiBetSlipInput = parsed.data;
    const stakeCheck = checkStake(slip.stake);
    if (!stakeCheck.ok) {
      res.status(409).json({ ok: false, error: stakeCheck });
      return;
    }
    const oddsCheck = checkOddsRange(slip.selections);
    if (!oddsCheck.ok) {
      res.status(409).json({ ok: false, error: oddsCheck });
      return;
    }
    const payoutCheck = checkMaxPayout(slip.stake, slip.selections);
    if (!payoutCheck.ok) {
      res.status(409).json({ ok: false, error: payoutCheck });
      return;
    }
    const profile = (await walletClient.getProfile(token)) as unknown as Record<string, any>;
    const userData = profile?.userData || profile;
    const userId = userData?.chatId || userData?.user_id || userData?.id;
    const username = userData?.username || userData?.userName || 'user';

    const validation = await Promise.all(
      slip.selections.map(async (selection) => {
        // Place bet validation: re-check against current proxy odds
        const oddsData = await apiFootball.proxy('/odds', { fixture: selection.fixtureId });

        // Similar validation to /validate
        if (!oddsData || !oddsData.response || !oddsData.response.length) {
          return { selection, ok: false, reason: 'Odds unavailable' };
        }

        const fixtureData = await apiFootball.proxy('/fixtures', { id: selection.fixtureId });
        const fixtureStatus = fixtureData.response?.[0]?.fixture?.status?.short;
        const inPlayStatuses = new Set(['1H', 'HT', '2H', 'ET', 'BT', 'P', 'SUSP', 'INT', 'LIVE', 'FT']);

        if (fixtureStatus && inPlayStatuses.has(fixtureStatus)) {
          return {
            selection,
            ok: false,
            error: { code: 'IN_PLAY', message: 'Fixture is in play or finished' },
          };
        }

        const detail = extractSelectionDetailsFromSnapshot(
          oddsData,
          selection,
          selection.fixtureId,
        );
        if (!detail.found) {
          return {
            selection,
            ok: false,
            error: { code: 'ODDS_CHANGED', message: 'Odds changed since selection' },
          };
        }
        if (detail.suspended) {
          return {
            selection,
            ok: false,
            error: { code: 'MARKET_SUSPENDED', message: 'Market suspended' },
          };
        }
        const exposure = await getExposureForOutcome(
          selection.fixtureId,
          selection.value,
          selection.betId,
          selection.handicap,
          selection.bookmakerId,
        );
        const projected = exposure + slip.stake * selection.odd;
        if (projected > config.risk.maxExposurePerOutcome) {
          return {
            selection,
            ok: false,
            error: {
              code: 'MAX_EXPOSURE',
              message: 'Exposure limit reached for this outcome',
            },
          };
        }
        return { selection, ok: true };
      }),
    );
    const ok = validation.every((r) => r.ok);
    if (!ok) {
      res.status(409).json({
        ok: false,
        reason: 'Odds changed or missing snapshot',
        validation,
      });
      return;
    }

    const betRef = `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const debitTx = `DEBIT_${betRef}`;
    await walletClient.debit(token, {
      chatId: userId,
      username,
      amount: slip.stake,
      game: config.walletGameName,
      round_id: betRef,
      transaction_id: debitTx,
    });

    let betId: number | null = null;
    try {
      betId = await createBetWithSelections(
        betRef,
        slip,
        { id: Number(userId) || undefined, username },
        'pending',
        debitTx,
      );
    } catch (dbErr) {
      try {
        await walletClient.credit(token, {
          chatId: userId,
          username,
          amount: slip.stake,
          game: config.walletGameName,
          round_id: betRef,
          transaction_id: `CREDIT_${betRef}`,
          debit_transaction_id: debitTx,
        });
      } catch (creditErr) {
        console.error('Failed to compensate wallet debit', creditErr);
      }
      throw dbErr;
    }
    if (!betId) {
      throw new HttpError(
        503,
        'DATABASE_UNAVAILABLE',
        'Database is required to place and persist bets',
      );
    }
    const bet = await getBetWithSelections(betId);
    res.json({ ok: true, bet });
  }),
);

router.get(
  '/bets',
  asyncHandler(async (_req: Request, res: Response) => {
    const bets = await listBetsWithSelections();
    res.json({ ok: true, bets });
  }),
);

router.get('/bets/:id', asyncHandler(async (req: Request, res: Response) => {
  const betId = Number(req.params.id);
  if (!Number.isFinite(betId)) {
    throw new HttpError(400, 'INVALID_BET_ID', 'Invalid bet id');
  }
  const bet = await getBetWithSelections(betId);
  if (!bet) {
    throw new HttpError(404, 'BET_NOT_FOUND', 'Bet not found');
  }
  res.json({ ok: true, bet });
}));

router.get('/bets/fixture/:fixtureId/pending', asyncHandler(async (req: Request, res: Response) => {
  const fixtureId = Number(req.params.fixtureId);
  if (!Number.isFinite(fixtureId)) {
    throw new HttpError(400, 'INVALID_FIXTURE_ID', 'Invalid fixture id');
  }
  const bets = await listPendingBetsByFixture(fixtureId);
  res.json({ ok: true, bets });
}));

router.post('/bets/:id/settle', asyncHandler(async (req: Request, res: Response) => {
    const token = requireBearerToken(req);
    const betId = Number(req.params.id);
    if (!Number.isFinite(betId)) {
      throw new HttpError(400, 'INVALID_BET_ID', 'Invalid bet id');
    }
    const parsed = settleBetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_SETTLEMENT', 'Invalid settlement payload', parsed.error.flatten());
    }
    const { result, payout } = parsed.data;
    const bet = await getBetWithSelections(betId);
    if (!bet) {
      throw new HttpError(404, 'BET_NOT_FOUND', 'Bet not found');
    }
    if (bet.status !== 'pending') {
      throw new HttpError(409, 'ALREADY_SETTLED', 'Bet already settled');
    }

    let walletCreditTx: string | null = null;
    const creditAmount = Number(payout ?? 0);
    if (result === 'won' && creditAmount > 0) {
      walletCreditTx = `CREDIT_${bet.betRef}_${Date.now()}`;
      await walletClient.credit(token, {
        chatId: bet.userId ?? undefined,
        username: bet.username ?? undefined,
        amount: creditAmount,
        game: config.walletGameName,
        round_id: bet.betRef,
        transaction_id: walletCreditTx,
        debit_transaction_id: bet.walletDebitTx ?? undefined,
      });
    }
    const updated = await updateBetSettlement(betId, {
      status: result,
      result,
      payout: creditAmount || null,
      walletCreditTx,
    });
    res.json({ ok: true, bet: updated });
}));

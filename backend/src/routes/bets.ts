import { Router, Request, Response } from 'express';
import { placeBet, BetSlip } from '../services/bets';
import { betSlipSchema } from '../validation/bets';
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

const extractOddMatch = (
  response: unknown,
  selection: {
    betId?: number | string;
    value: string;
    odd: number;
    bookmakerId?: number;
    handicap?: string | number;
  },
): boolean => {
  if (!Array.isArray(response)) return false;
  const targetHandicap = normalizeHandicap(selection.handicap);
  for (const item of response) {
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
        return true;
      }
    }
  }
  return false;
};

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
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

router.post('/betslip/validate', async (req: Request, res: Response) => {
  try {
    const parsed = betSlipSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: 'Invalid betslip', errors: parsed.error.flatten() });
      return;
    }
    const slip = parsed.data as BetSlip;

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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

router.post('/betslip/place', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ ok: false, reason: 'Missing Bearer token' });
      return;
    }
    const parsed = betSlipSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, reason: 'Invalid betslip', errors: parsed.error.flatten() });
      return;
    }
    const slip = parsed.data as BetSlip;
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
    const bet = betId ? await getBetWithSelections(betId) : placeBet(slip, 'pending');
    res.json({ ok: true, bet });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

router.get('/bets', (_req: Request, res: Response) => {
  listBetsWithSelections()
    .then((bets) => res.json({ ok: true, bets }))
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: message });
    });
});

router.get('/bets/:id', (req: Request, res: Response) => {
  const betId = Number(req.params.id);
  if (!Number.isFinite(betId)) {
    res.status(400).json({ ok: false, error: 'Invalid bet id' });
    return;
  }
  getBetWithSelections(betId)
    .then((bet) => {
      if (!bet) {
        res.status(404).json({ ok: false, error: 'Bet not found' });
        return;
      }
      res.json({ ok: true, bet });
    })
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: message });
    });
});

router.get('/bets/fixture/:fixtureId/pending', (req: Request, res: Response) => {
  const fixtureId = Number(req.params.fixtureId);
  if (!Number.isFinite(fixtureId)) {
    res.status(400).json({ ok: false, error: 'Invalid fixture id' });
    return;
  }
  listPendingBetsByFixture(fixtureId)
    .then((bets) => res.json({ ok: true, bets }))
    .catch((err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ ok: false, error: message });
    });
});

router.post('/bets/:id/settle', async (req: Request, res: Response) => {
  try {
    const token = extractToken(req);
    if (!token) {
      res.status(401).json({ ok: false, error: 'Missing Bearer token' });
      return;
    }
    const betId = Number(req.params.id);
    if (!Number.isFinite(betId)) {
      res.status(400).json({ ok: false, error: 'Invalid bet id' });
      return;
    }
    const { result, payout } = req.body as {
      result: 'won' | 'lost' | 'void';
      payout?: number;
    };
    if (!result || !['won', 'lost', 'void'].includes(result)) {
      res.status(400).json({ ok: false, error: 'Invalid result' });
      return;
    }
    const bet = await getBetWithSelections(betId);
    if (!bet) {
      res.status(404).json({ ok: false, error: 'Bet not found' });
      return;
    }
    if (bet.status !== 'pending') {
      res.status(409).json({ ok: false, error: 'Bet already settled' });
      return;
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ ok: false, error: message });
  }
});

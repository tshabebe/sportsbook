import { Router, Request, Response } from 'express';
import { fetchApi } from '../services/apiFootball';
import { placeBet, BetSlip } from '../services/bets';
import { betSlipSchema } from '../validation/bets';
import {
  createBetWithSelections,
  getBetWithSelections,
  getLatestOddsSnapshotForFixture,
  getExposureForOutcome,
  listBetsWithSelections,
  listPendingBetsByFixture,
  updateBetSettlement,
} from '../services/db';
import { walletClient } from '../services/walletClient';
import { config } from '../services/config';
import { checkMaxPayout, checkOddsRange, checkStake } from '../services/risk';

export const router = Router();

const extractOddMatch = (
  response: unknown,
  selection: { betId?: number | string; value: string; odd: number; bookmakerId?: number },
): boolean => {
  if (!Array.isArray(response)) return false;
  for (const item of response) {
    const bookmaker = item?.bookmaker?.id;
    if (selection.bookmakerId && bookmaker && Number(bookmaker) !== Number(selection.bookmakerId)) {
      continue;
    }
    const bets = item?.bets ?? [];
    for (const bet of bets) {
      if (selection.betId && bet?.id && String(bet.id) !== String(selection.betId)) {
        continue;
      }
      const values = bet?.values ?? [];
      for (const value of values) {
        if (
          String(value?.value ?? '').toLowerCase() === selection.value.toLowerCase() &&
          Number(value?.odd) === Number(selection.odd)
        ) {
          return true;
        }
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

const extractSelectionMatchFromSnapshot = (
  snapshot: unknown,
  selection: { betId?: number | string; value: string; odd: number; bookmakerId?: number },
  fixtureId: number,
): boolean => {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const response = (snapshot as { response?: unknown }).response;
  if (!Array.isArray(response)) return false;
  const fixtureItems = response.filter(
    (item) => Number(item?.fixture?.id) === Number(fixtureId),
  );
  for (const item of fixtureItems) {
    if (extractOddMatch([item], selection)) {
      return true;
    }
  }
  return false;
};

const extractSelectionDetailsFromSnapshot = (
  snapshot: unknown,
  selection: { betId?: number | string; value: string; odd: number; bookmakerId?: number },
  fixtureId: number,
): { found: boolean; suspended?: boolean } => {
  if (!snapshot || typeof snapshot !== 'object') return { found: false };
  const response = (snapshot as { response?: unknown }).response;
  if (!Array.isArray(response)) return { found: false };
  const fixtureItems = response.filter(
    (item) => Number(item?.fixture?.id) === Number(fixtureId),
  );
  for (const item of fixtureItems) {
    const bookmaker = item?.bookmaker?.id;
    if (selection.bookmakerId && bookmaker && Number(bookmaker) !== Number(selection.bookmakerId)) {
      continue;
    }
    const bets = item?.bets ?? [];
    for (const bet of bets) {
      if (selection.betId && bet?.id && String(bet.id) !== String(selection.betId)) {
        continue;
      }
      const values = bet?.values ?? [];
      for (const value of values) {
        if (
          String(value?.value ?? '').toLowerCase() === selection.value.toLowerCase() &&
          Number(value?.odd) === Number(selection.odd)
        ) {
          return { found: true, suspended: Boolean(value?.suspended) };
        }
      }
    }
  }
  return { found: false };
};

const isSnapshotStale = (capturedAt: string): boolean => {
  const captured = Date.parse(capturedAt);
  if (Number.isNaN(captured)) return true;
  const ageSeconds = (Date.now() - captured) / 1000;
  return ageSeconds > config.risk.snapshotMaxAgeSeconds;
};

const isFixtureInPlay = (snapshot: unknown, fixtureId: number): boolean => {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const response = (snapshot as { response?: unknown }).response;
  if (!Array.isArray(response)) return false;
  const item = response.find((row) => Number(row?.fixture?.id) === Number(fixtureId));
  const status = String(item?.fixture?.status?.short ?? '').toUpperCase();
  return status !== '' && status !== 'NS';
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
        const snapshot = await getLatestOddsSnapshotForFixture(selection.fixtureId);
        if (!snapshot) {
          return {
            selection,
            ok: false,
            error: { code: 'SNAPSHOT_MISSING', message: 'Odds snapshot not available' },
          };
        }
        if (isSnapshotStale(snapshot.capturedAt)) {
          return {
            selection,
            ok: false,
            error: { code: 'SNAPSHOT_STALE', message: 'Odds snapshot is stale' },
          };
        }
        if (isFixtureInPlay(snapshot.payload, selection.fixtureId)) {
          return {
            selection,
            ok: false,
            error: { code: 'IN_PLAY', message: 'Fixture already in play' },
          };
        }
        const detail = extractSelectionDetailsFromSnapshot(
          snapshot.payload,
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
        const exposure = await getExposureForOutcome(selection.fixtureId, selection.value);
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
        const snapshot = await getLatestOddsSnapshotForFixture(selection.fixtureId);
        if (!snapshot) {
          return { selection, ok: false, reason: 'Snapshot not available' };
        }
        if (isSnapshotStale(snapshot.capturedAt)) {
          return {
            selection,
            ok: false,
            error: { code: 'SNAPSHOT_STALE', message: 'Odds snapshot is stale' },
          };
        }
        if (isFixtureInPlay(snapshot.payload, selection.fixtureId)) {
          return {
            selection,
            ok: false,
            error: { code: 'IN_PLAY', message: 'Fixture already in play' },
          };
        }
        const detail = extractSelectionDetailsFromSnapshot(
          snapshot.payload,
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
        const exposure = await getExposureForOutcome(selection.fixtureId, selection.value);
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

    const debitTx = `DEBIT_aviator_${Date.now()}`;
    await walletClient.debit(token, {
      chatId: userId,
      username,
      amount: slip.stake,
      game: 'Aviator',
      round_id: `bet_${Date.now()}`,
      transaction_id: debitTx,
    });

    const betRef = `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const betId = await createBetWithSelections(
      betRef,
      slip,
      { id: Number(userId) || undefined, username },
      'pending',
      debitTx,
    );
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

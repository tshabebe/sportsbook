import { Router, Request, Response } from 'express';
import { betSlipSchema, settleBetSchema } from '../validation/bets';
import type { ApiBetSlipInput } from '../validation/bets';
import {
  createRetailBooking,
  createBetWithSelections,
  createRetailTicketForBet,
  getBetWithSelections,
  getExposureForOutcome,
  getRetailBookingByBookCode,
  getRetailTicketByTicketId,
  listBetsWithSelections,
  listPendingBetsByFixture,
  settleRetailTicketByBet,
  updateBetSettlement,
} from '../services/db';
import { walletClient } from '../services/walletClient';
import { config } from '../services/config';
import { checkOddsRange, checkStake } from '../services/risk';
import { apiFootball } from '../services/apiFootball';
import { asyncHandler } from '../middleware/asyncHandler';
import { HttpError } from '../lib/http';
import { requireBearerToken, requireRetailerToken } from './utils';
import { expandBetSlipLines, totalPotentialPayout } from '../services/betModes';
import { ensureSufficientBalance } from '../services/balance';
import { generateRetailBookCode } from '../services/bookCode';
import { normalizeSlipForSelections } from '../services/slipNormalization';
import {
  extractSelectionDetailsFromSnapshot,
  isFixtureBlockedForPlacement,
} from '../services/betValidation';
import {
  loadMarketCatalog,
  validateMarketForPlacement,
} from '../services/marketCatalog';
import { normalizeBookCodeRoot } from '../services/recreateSlip';
import { z } from 'zod';

export const router = Router();

const checkSlipRisk = (slip: ApiBetSlipInput) => {
  const stakeCheck = checkStake(slip.stake);
  if (!stakeCheck.ok) return stakeCheck;

  const oddsCheck = checkOddsRange(slip.selections);
  if (!oddsCheck.ok) return oddsCheck;

  const lines = expandBetSlipLines(slip);
  const potentialPayout = totalPotentialPayout(lines);
  if (potentialPayout > config.risk.maxPayout) {
    return {
      ok: false as const,
      code: 'MAX_PAYOUT',
      message: `Maximum payout is ${config.risk.maxPayout}`,
      context: { maxPayout: config.risk.maxPayout, payout: potentialPayout },
    };
  }

  return { ok: true as const };
};

const validateSlipSelections = async (
  slip: ApiBetSlipInput,
  withExposure: boolean,
) => {
  const selectionStubResults = slip.selections.map((selection) => ({
    lineKey: 'line_0',
    selection,
  }));

  let marketCatalog;
  try {
    marketCatalog = await loadMarketCatalog();
  } catch {
    return {
      slip,
      lines: [] as ReturnType<typeof expandBetSlipLines>,
      results: selectionStubResults.map((entry) => ({
        ...entry,
        ok: false as const,
        error: {
          code: 'MARKET_CATALOG_UNAVAILABLE',
          message: 'Market catalog unavailable',
        },
      })),
      removedSelections: [] as ApiBetSlipInput['selections'],
      ok: false,
    };
  }

  if (marketCatalog.size === 0) {
    return {
      slip,
      lines: [] as ReturnType<typeof expandBetSlipLines>,
      results: selectionStubResults.map((entry) => ({
        ...entry,
        ok: false as const,
        error: {
          code: 'MARKET_CATALOG_UNAVAILABLE',
          message: 'Market catalog is empty',
        },
      })),
      removedSelections: [] as ApiBetSlipInput['selections'],
      ok: false,
    };
  }

  const fixtureStatusCache = new Map<number, string | undefined>();
  const validSelections: ApiBetSlipInput['selections'] = [];
  const removedSelections: ApiBetSlipInput['selections'] = [];
  const precheckResults: Array<{
    lineKey: string;
    selection: ApiBetSlipInput['selections'][number];
    ok: boolean;
    dropped?: boolean;
    error?: { code: string; message: string; details?: unknown };
  }> = [];

  for (const selection of slip.selections) {
    const marketValidation = validateMarketForPlacement(
      selection.betId,
      marketCatalog,
    );
    if (!marketValidation.ok) {
      precheckResults.push({
        lineKey: 'line_0',
        selection,
        ok: false,
        error: {
          code: marketValidation.code,
          message: marketValidation.message,
          details: marketValidation.details,
        },
      });
      continue;
    }

    let fixtureStatus = fixtureStatusCache.get(selection.fixtureId);
    if (fixtureStatus === undefined && !fixtureStatusCache.has(selection.fixtureId)) {
      try {
        const fixtureData = await apiFootball.proxy('/fixtures', { id: selection.fixtureId });
        fixtureStatus = fixtureData.response?.[0]?.fixture?.status?.short;
        fixtureStatusCache.set(selection.fixtureId, fixtureStatus);
      } catch {
        precheckResults.push({
          lineKey: 'line_0',
          selection,
          ok: false,
          error: { code: 'FIXTURE_UNAVAILABLE', message: 'Fixture provider unavailable' },
        });
        continue;
      }
    }

    if (isFixtureBlockedForPlacement(fixtureStatus)) {
      removedSelections.push(selection);
      precheckResults.push({
        lineKey: 'line_0',
        selection,
        ok: true,
        dropped: true,
        error: {
          code: 'SELECTION_EXPIRED_REMOVED',
          message: 'Selection removed because fixture is in play or finished',
          details: { fixtureId: selection.fixtureId, fixtureStatus },
        },
      });
      continue;
    }

    validSelections.push(selection);
  }

  const fatalPrecheck = precheckResults.filter((result) => !result.ok);
  if (fatalPrecheck.length > 0) {
    return {
      slip,
      lines: [] as ReturnType<typeof expandBetSlipLines>,
      results: precheckResults,
      removedSelections,
      ok: false,
    };
  }

  const normalizedSlip = normalizeSlipForSelections(slip, validSelections);
  if (!normalizedSlip) {
    return {
      slip,
      lines: [] as ReturnType<typeof expandBetSlipLines>,
      results: [
        ...precheckResults,
        ...selectionStubResults.map((entry) => ({
          ...entry,
          ok: false as const,
          error: {
            code: 'NO_VALID_SELECTIONS',
            message: 'All selections are expired or unavailable',
          },
        })),
      ],
      removedSelections,
      ok: false,
    };
  }

  const lines = expandBetSlipLines(normalizedSlip);
  const oddsSnapshotByFixture = new Map<number, unknown>();

  const lineResults = await Promise.all(
    lines.flatMap((line) =>
      line.selections.map(async (selection) => {
        let oddsData = oddsSnapshotByFixture.get(selection.fixtureId);
        if (!oddsData) {
          try {
            oddsData = await apiFootball.proxy('/odds', { fixture: selection.fixtureId });
            oddsSnapshotByFixture.set(selection.fixtureId, oddsData);
          } catch {
            return {
              lineKey: line.key,
              selection,
              ok: false,
              error: { code: 'ODDS_UNAVAILABLE', message: 'Odds provider unavailable' },
            };
          }
        }
        const oddsPayload = oddsData as { response?: unknown[] } | undefined;
        if (!oddsPayload || !oddsPayload.response || !oddsPayload.response.length) {
          return {
            lineKey: line.key,
            selection,
            ok: false,
            error: { code: 'ODDS_UNAVAILABLE', message: 'Odds currently unavailable for this fixture' },
          };
        }

        const detail = extractSelectionDetailsFromSnapshot(
          oddsPayload,
          selection,
          selection.fixtureId,
        );
        if (!detail.found) {
          return {
            lineKey: line.key,
            selection,
            ok: false,
            error: { code: 'ODDS_CHANGED', message: 'Odds changed or selection no longer available' },
          };
        }
        if (detail.suspended) {
          return {
            lineKey: line.key,
            selection,
            ok: false,
            error: { code: 'MARKET_SUSPENDED', message: 'Market suspended' },
          };
        }

        if (withExposure) {
          let exposure = 0;
          try {
            exposure = await getExposureForOutcome(
              selection.fixtureId,
              selection.value,
              selection.betId,
              selection.handicap,
              selection.bookmakerId,
            );
          } catch {
            return {
              lineKey: line.key,
              selection,
              ok: false,
              error: {
                code: 'EXPOSURE_UNAVAILABLE',
                message: 'Exposure check unavailable',
              },
            };
          }
          const projected = exposure + line.stake * selection.odd;
          if (projected > config.risk.maxExposurePerOutcome) {
            return {
              lineKey: line.key,
              selection,
              ok: false,
              error: {
                code: 'MAX_EXPOSURE',
                message: 'Exposure limit reached for this outcome',
              },
            };
          }
        }

        return { lineKey: line.key, selection, ok: true };
      }),
    ),
  );

  const results = [...lineResults, ...precheckResults];
  return {
    slip: normalizedSlip,
    lines,
    results,
    removedSelections,
    ok: lineResults.every((r) => r.ok),
  };
};

type FixtureLookupMeta = {
  fixtureId: number;
  fixtureDate: string;
  leagueName: string;
  leagueCountry: string;
  homeName: string;
  awayName: string;
};

const marketNameFromBetId = (betId?: number | string): string => {
  const normalized = Number(betId);
  if (normalized === 1) return 'Match Winner';
  if (normalized === 12) return 'Double Chance';
  if (normalized === 5) return 'Over/Under 2.5';
  return 'Market';
};

const selectionNameFromValue = (
  value: string,
  betId: number | string | undefined,
  fixture: FixtureLookupMeta | undefined,
): string => {
  const normalizedBetId = Number(betId);
  const home = fixture?.homeName ?? 'Home';
  const away = fixture?.awayName ?? 'Away';

  if (normalizedBetId === 1) {
    if (/^home$/i.test(value)) return home;
    if (/^away$/i.test(value)) return away;
    if (/^draw$/i.test(value)) return 'Draw';
  }

  if (normalizedBetId === 12) {
    if (/^home\/draw$/i.test(value)) return `${home}/Draw`;
    if (/^home\/away$/i.test(value)) return `${home}/${away}`;
    if (/^draw\/away$/i.test(value)) return `Draw/${away}`;
  }

  return value;
};

const sanitizeSelectionToken = (value: string): string =>
  value.replace(/[^a-zA-Z0-9_/-]/g, '_');

const validationFailureReason = (
  results: Array<{ ok: boolean; error?: { message?: string } }>,
): string => results.find((item) => !item.ok)?.error?.message ?? 'Validation failed';

router.post(
  '/betslip/validate',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = betSlipSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'INVALID_BETSLIP', 'Invalid betslip', parsed.error.flatten());
    }
    const slip: ApiBetSlipInput = parsed.data;
    const validation = await validateSlipSelections(slip, true);
    const riskCheck = checkSlipRisk(validation.slip);
    if (!riskCheck.ok) {
      res.json({ ok: false, error: riskCheck, results: validation.results });
      return;
    }
    res.json({
      ok: validation.ok,
      mode: validation.slip.mode,
      lines: validation.lines.map((line) => ({
        key: line.key,
        stake: line.stake,
        potentialPayout: line.potentialPayout,
        selections: line.selections.length,
      })),
      totalPotentialPayout: totalPotentialPayout(validation.lines),
      results: validation.results,
      removedSelections: validation.removedSelections.map((selection) => ({
        fixtureId: selection.fixtureId,
        betId: selection.betId,
        value: selection.value,
      })),
    });
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
    const validation = await validateSlipSelections(slip, true);
    const riskCheck = checkSlipRisk(validation.slip);
    if (!riskCheck.ok) {
      res.status(409).json({ ok: false, error: riskCheck });
      return;
    }
    if (!validation.ok) {
      res.status(409).json({
        ok: false,
        reason: validationFailureReason(validation.results),
        validation: validation.results,
      });
      return;
    }

    const profile = (await walletClient.getProfile(token)) as unknown as Record<string, any>;
    const userData = profile?.userData || profile;
    const userIdRaw = userData?.chatId || userData?.user_id || userData?.id;
    const userId = Number(userIdRaw);
    if (!Number.isFinite(userId) || userId <= 0) {
      throw new HttpError(401, 'INVALID_WALLET_PROFILE', 'Wallet profile is missing a valid user id');
    }
    const username = userData?.username || userData?.userName || 'user';

    const balanceCheck = ensureSufficientBalance(profile, slip.stake);
    if (!balanceCheck.ok) {
      res.status(409).json({ ok: false, error: balanceCheck });
      return;
    }

    const betRef = `bet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const debitTx = `DEBIT_${betRef}`;
    try {
      await walletClient.debit(token, {
        chatId: userId,
        username,
        amount: slip.stake,
        game: config.walletGameName,
        round_id: betRef,
        transaction_id: debitTx,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Wallet debit failed';
      if (/insufficient|not enough|balance/i.test(message)) {
        throw new HttpError(409, 'INSUFFICIENT_BALANCE', 'Insufficient balance');
      }
      throw new HttpError(502, 'WALLET_DEBIT_FAILED', 'Failed to debit wallet');
    }

    const lineBetIds: number[] = [];
    try {
      for (const [index, line] of validation.lines.entries()) {
        const lineSlip: ApiBetSlipInput = {
          ...validation.slip,
          selections: line.selections,
          stake: line.stake,
          mode: 'multiple',
          systemSize: undefined,
        };
        const lineBetId = await createBetWithSelections(
          `${betRef}_L${index + 1}`,
          lineSlip,
          { id: userId, username },
          'pending',
          debitTx,
        );
        if (!lineBetId) {
          throw new Error(`Failed to create bet line ${index + 1}`);
        }
        lineBetIds.push(lineBetId);
      }
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
    const lineBets = (
      await Promise.all(lineBetIds.map((id) => getBetWithSelections(id)))
    ).filter((bet): bet is NonNullable<typeof bet> => Boolean(bet));
    res.json({
      ok: true,
      ticket: {
        ticketRef: betRef,
        mode: validation.slip.mode,
        totalStake: validation.slip.stake,
        totalPotentialPayout: totalPotentialPayout(validation.lines),
        lineCount: lineBets.length,
      },
      bet: lineBets[0] ?? null,
      bets: lineBets,
    });
  }),
);

const placeRetailTicketFromSlip = async (req: Request, res: Response) => {
  const parsed = betSlipSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'INVALID_BETSLIP', 'Invalid betslip', parsed.error.flatten());
  }
  const slip: ApiBetSlipInput = parsed.data;
  const validation = await validateSlipSelections(slip, false);
  const riskCheck = checkSlipRisk(validation.slip);
  if (!riskCheck.ok) {
    res.status(409).json({ ok: false, error: riskCheck });
    return;
  }
  if (!validation.ok) {
    res.status(409).json({
      ok: false,
      reason: validationFailureReason(validation.results),
      validation: validation.results,
    });
    return;
  }

  const bookCode = generateRetailBookCode();
  const booking = await createRetailBooking({
    bookCode,
    slipJson: validation.slip,
  });

  res.json({
    ok: true,
    bookCode,
    booking: {
      id: booking.id,
      bookCode: booking.bookCode,
      createdAt: booking.createdAt,
    },
    mode: validation.slip.mode,
    totalStake: validation.slip.stake,
    totalPotentialPayout: totalPotentialPayout(validation.lines),
    lineCount: validation.lines.length,
    removedSelections: validation.removedSelections.map((selection) => ({
      fixtureId: selection.fixtureId,
      betId: selection.betId,
      value: selection.value,
    })),
  });
};

const issueRetailBookingSchema = z
  .object({
    bookCode: z.string().min(6).max(64),
  })
  .strict();

const issueRetailTicketFromBooking = async (req: Request, res: Response) => {
  const auth = requireRetailerToken(req);
  const parsed = issueRetailBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new HttpError(400, 'INVALID_BOOK_CODE', 'Invalid book code payload', parsed.error.flatten());
  }

  const rootBookCode = normalizeBookCodeRoot(parsed.data.bookCode);
  const booking = await getRetailBookingByBookCode(rootBookCode);
  if (!booking) {
    throw new HttpError(404, 'BOOK_CODE_NOT_FOUND', 'Book code not found');
  }

  const slipParsed = betSlipSchema.safeParse(booking.slipJson);
  if (!slipParsed.success) {
    throw new HttpError(500, 'BOOKING_CORRUPTED', 'Stored booking is invalid');
  }

  const slip = slipParsed.data;
  const validation = await validateSlipSelections(slip, false);
  const riskCheck = checkSlipRisk(validation.slip);
  if (!riskCheck.ok) {
    res.status(409).json({ ok: false, error: riskCheck });
    return;
  }
  if (!validation.ok) {
    res.status(409).json({
      ok: false,
      reason: validationFailureReason(validation.results),
      validation: validation.results,
    });
    return;
  }

  const rootTicketId = generateRetailBookCode();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3); // 72h claim window
  const tickets = [];
  const bets = [];

  for (const [index, line] of validation.lines.entries()) {
    const ticketId = index === 0 ? rootTicketId : `${rootTicketId}-${index + 1}`;
    const lineSlip: ApiBetSlipInput = {
      ...validation.slip,
      selections: line.selections,
      stake: line.stake,
      mode: 'multiple',
      systemSize: undefined,
    };
    const betRef = `retail_${ticketId}`;
    const betId = await createBetWithSelections(
      betRef,
      lineSlip,
      {},
      'pending',
      undefined,
      { channel: 'online_retail_ticket', ticketId },
    );
    if (!betId) {
      throw new HttpError(500, 'BET_CREATION_FAILED', 'Failed to create retail bet');
    }
    const ticket = await createRetailTicketForBet({
      ticketId,
      betId,
      expiresAt,
      claimedByRetailerId: auth.retailerId,
      sourceBookCode: rootBookCode,
    });
    const bet = await getBetWithSelections(betId);
    tickets.push(ticket);
    bets.push(bet);
  }

  res.json({
    ok: true,
    sourceBookCode: rootBookCode,
    ticketBatchId: rootTicketId,
    mode: validation.slip.mode,
    totalStake: validation.slip.stake,
    totalPotentialPayout: totalPotentialPayout(validation.lines),
    lineCount: validation.lines.length,
    issuedByRetailerId: auth.retailerId,
    tickets: tickets.map((ticket) => ({
      ticketId: ticket.ticketId,
      status: ticket.status,
      expiresAt: ticket.expiresAt,
      sourceBookCode: ticket.sourceBookCode,
      claimedByRetailerId: ticket.claimedByRetailerId,
      claimedAt: ticket.claimedAt,
    })),
    removedSelections: validation.removedSelections.map((selection) => ({
      fixtureId: selection.fixtureId,
      betId: selection.betId,
      value: selection.value,
    })),
    bet: bets[0] ?? null,
    bets,
  });
};

router.post(
  '/betslip/place-retail',
  asyncHandler(placeRetailTicketFromSlip),
);

router.post(
  '/retail/tickets/issue',
  asyncHandler(issueRetailTicketFromBooking),
);

router.get(
  '/tickets/:ticketId/recreate',
  asyncHandler(async (req: Request, res: Response) => {
    const requestedTicketId = String(req.params.ticketId ?? '').trim();
    if (!requestedTicketId) {
      throw new HttpError(400, 'INVALID_TICKET_ID', 'Invalid ticket id');
    }

    const bookCode = normalizeBookCodeRoot(requestedTicketId);
    const booking = await getRetailBookingByBookCode(bookCode);
    if (!booking) {
      throw new HttpError(404, 'BOOK_CODE_NOT_FOUND', 'Book code not found');
    }

    const storedSlip = betSlipSchema.safeParse(booking.slipJson);
    if (!storedSlip.success) {
      throw new HttpError(500, 'BOOKING_CORRUPTED', 'Stored booking is invalid');
    }
    const slip: ApiBetSlipInput = storedSlip.data;

    const fixtureLookup = new Map<number, FixtureLookupMeta>();
    const fixtureIds = Array.from(
      new Set(slip.selections.map((selection) => selection.fixtureId)),
    );

    if (fixtureIds.length > 0) {
      const CHUNK_SIZE = 20;
      const chunks: number[][] = [];
      for (let i = 0; i < fixtureIds.length; i += CHUNK_SIZE) {
        chunks.push(fixtureIds.slice(i, i + CHUNK_SIZE));
      }

      try {
        const fixtureResponses = await Promise.all(
          chunks.map((chunk) =>
            apiFootball.proxy('/fixtures', { ids: chunk.join('-') }),
          ),
        );

        for (const payload of fixtureResponses) {
          const response = Array.isArray((payload as { response?: unknown }).response)
            ? ((payload as { response: unknown[] }).response as Array<{
              fixture?: { id?: number; date?: string };
              league?: { name?: string; country?: string };
              teams?: { home?: { name?: string }; away?: { name?: string } };
            }>)
            : [];

          for (const fixture of response) {
            const fixtureId = Number(fixture?.fixture?.id);
            if (!Number.isFinite(fixtureId) || fixtureId <= 0) continue;
            fixtureLookup.set(fixtureId, {
              fixtureId,
              fixtureDate: fixture?.fixture?.date ?? '',
              leagueName: fixture?.league?.name ?? '',
              leagueCountry: fixture?.league?.country ?? '',
              homeName: fixture?.teams?.home?.name ?? 'Home',
              awayName: fixture?.teams?.away?.name ?? 'Away',
            });
          }
        }
      } catch (error) {
        console.error('Failed to enrich recreated slip with fixtures', error);
      }
    }

    const bets = slip.selections.map((selection, index) => {
      const fixture = fixtureLookup.get(selection.fixtureId);
      const fixtureName = fixture
        ? `${fixture.homeName} vs ${fixture.awayName}`
        : `Fixture ${selection.fixtureId}`;
      const marketName = marketNameFromBetId(selection.betId);
      const selectionName = selectionNameFromValue(
        selection.value,
        selection.betId,
        fixture,
      );

      return {
        id: `${selection.fixtureId}-${selection.betId ?? 'm'}-${sanitizeSelectionToken(selection.value)}-${index + 1}`,
        fixtureId: selection.fixtureId,
        betId: selection.betId,
        value: selection.value,
        odd: selection.odd,
        bookmakerId: selection.bookmakerId ?? 8,
        handicap: selection.handicap,
        fixtureName,
        marketName,
        selectionName,
        odds: selection.odd,
        leagueName: fixture?.leagueName ?? '',
        leagueCountry: fixture?.leagueCountry ?? '',
        fixtureDate: fixture?.fixtureDate ?? undefined,
      };
    });

    res.json({
      ok: true,
      bookCode,
      slip,
      bets,
      booking: {
        id: booking.id,
        createdAt: booking.createdAt,
      },
    });
  }),
);

router.get(
  '/tickets/:ticketId',
  asyncHandler(async (req: Request, res: Response) => {
    const ticketId = String(req.params.ticketId ?? '').trim();
    if (!ticketId) {
      throw new HttpError(400, 'INVALID_TICKET_ID', 'Invalid ticket id');
    }

    const ticket = await getRetailTicketByTicketId(ticketId);
    if (!ticket) {
      throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket not found');
    }

    res.json({
      ok: true,
      ticket: {
        ticketId: ticket.ticketId,
        status: ticket.status,
        createdAt: ticket.createdAt,
        sourceBookCode: ticket.sourceBookCode,
        claimedByRetailerId: ticket.claimedByRetailerId,
        claimedAt: ticket.claimedAt,
        paidAt: ticket.paidAt,
        payoutAmount: ticket.payoutAmount,
        expiresAt: ticket.expiresAt,
      },
      bet: {
        id: ticket.bet.id,
        status: ticket.bet.status,
        stake: ticket.bet.stake,
        payout: ticket.bet.payout,
        settledAt: ticket.bet.settledAt,
      },
    });
  }),
);

router.get(
  '/bets/my',
  asyncHandler(async (req: Request, res: Response) => {
    const token = requireBearerToken(req);
    const profile = (await walletClient.getProfile(token)) as unknown as Record<string, any>;
    const userData = profile?.userData || profile;
    const userIdRaw = userData?.chatId || userData?.user_id || userData?.id;
    const userId = Number(userIdRaw);

    if (!Number.isFinite(userId) || userId <= 0) {
      throw new HttpError(401, 'INVALID_WALLET_PROFILE', 'User not authenticated');
    }

    // Since listBetsWithSelections returns everything, we filter it here or add a new service.
    // Let's add a filtering logic or a new service call if possible. 
    // For now, filtering the result of listBetsWithSelections for speed.
    const allBets = await listBetsWithSelections();
    const userBets = allBets.filter(bet => bet.userId === userId);

    res.json({ ok: true, bets: userBets });
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
  await settleRetailTicketByBet({
    betId,
    result,
    payout: creditAmount || null,
  });
  res.json({ ok: true, bet: updated });
}));

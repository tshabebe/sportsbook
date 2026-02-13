import { apiFootball } from './apiFootball';
import {
  getRetailTicketByTicketId,
  settleRetailTicketByBet,
  updateBetSettlement,
} from './db';
import {
  resolveBetOutcome,
  shouldFetchEventsForMarket,
  shouldFetchStatisticsForMarket,
  type FixtureSettlementContext,
  type SelectionSettlementInput,
} from './settlementResolver';

type OddsBetCatalogRow = {
  id?: string | number;
  name?: string;
  bet?: {
    id?: string | number;
    name?: string;
  };
};

type FixtureApiRow = {
  fixture?: {
    id?: number;
    status?: {
      short?: string;
    };
  };
  teams?: {
    home?: { id?: number; name?: string };
    away?: { id?: number; name?: string };
  };
  goals?: {
    home?: number | null;
    away?: number | null;
  };
  score?: {
    halftime?: { home?: number | null; away?: number | null };
    fulltime?: { home?: number | null; away?: number | null };
    extratime?: { home?: number | null; away?: number | null };
    penalty?: { home?: number | null; away?: number | null };
  };
};

type FixtureEventRow = {
  type?: string;
  detail?: string;
  team?: { id?: number; name?: string };
  player?: { id?: number; name?: string };
};

type FixtureStatisticsRow = {
  team?: { id?: number; name?: string };
  statistics?: Array<{ type?: string; value?: string | number | null }>;
};

const SETTLEABLE_RETAIL_TICKET_STATUSES = new Set(['open', 'claimed']);

const toFiniteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const chunkNumbers = (input: number[], size: number): number[][] => {
  const chunks: number[][] = [];
  for (let i = 0; i < input.length; i += size) {
    chunks.push(input.slice(i, i + size));
  }
  return chunks;
};

const loadMarketNames = async (
  marketBetIds: Set<string>,
): Promise<Map<string, string>> => {
  if (marketBetIds.size === 0) return new Map();

  try {
    const payload = await apiFootball.proxy<OddsBetCatalogRow[]>('/odds/bets');
    const rows = Array.isArray(payload.response) ? payload.response : [];
    const marketNames = new Map<string, string>();

    for (const row of rows) {
      const rowId = row?.id ?? row?.bet?.id;
      const rowName = row?.name ?? row?.bet?.name;
      if (rowId === undefined || rowId === null || !rowName) continue;
      const key = String(rowId).trim();
      const name = String(rowName).trim();
      if (!key || !name) continue;
      marketNames.set(key, name);
    }

    const filtered = new Map<string, string>();
    for (const marketBetId of marketBetIds) {
      const name = marketNames.get(marketBetId);
      if (name) filtered.set(marketBetId, name);
    }
    return filtered;
  } catch (error) {
    console.warn('Failed to load API-Football odds bet catalog for settlement', error);
    return new Map();
  }
};

const loadFixtureContexts = async (
  fixtureIds: number[],
  fixtureIdsNeedingEvents: Set<number>,
  fixtureIdsNeedingStatistics: Set<number>,
): Promise<Map<number, FixtureSettlementContext>> => {
  const fixtureById = new Map<number, FixtureSettlementContext>();

  const fixtureChunks = chunkNumbers(fixtureIds, 20);
  const fixturePayloads = await Promise.all(
    fixtureChunks.map((chunk) =>
      apiFootball.proxy<FixtureApiRow[]>('/fixtures', {
        ids: chunk.join('-'),
      }),
    ),
  );

  for (const payload of fixturePayloads) {
    const rows = Array.isArray(payload.response) ? payload.response : [];
    for (const row of rows) {
      const fixtureId = toFiniteNumber(row?.fixture?.id);
      if (fixtureId === null || fixtureId <= 0) continue;

      fixtureById.set(fixtureId, {
        fixtureId,
        statusShort: row?.fixture?.status?.short,
        teams: {
          home: row?.teams?.home,
          away: row?.teams?.away,
        },
        goals: row?.goals,
        score: row?.score,
      });
    }
  }

  await Promise.all(
    Array.from(fixtureIdsNeedingEvents).map(async (fixtureId) => {
      try {
        const payload = await apiFootball.proxy<FixtureEventRow[]>('/fixtures/events', {
          fixture: fixtureId,
        });
        const events = Array.isArray(payload.response) ? payload.response : [];
        const fixture = fixtureById.get(fixtureId);
        if (fixture) fixture.events = events;
      } catch (error) {
        console.warn(`Failed to load fixture events for settlement (${fixtureId})`, error);
      }
    }),
  );

  await Promise.all(
    Array.from(fixtureIdsNeedingStatistics).map(async (fixtureId) => {
      try {
        const payload = await apiFootball.proxy<FixtureStatisticsRow[]>(
          '/fixtures/statistics',
          {
            fixture: fixtureId,
          },
        );
        const statistics = Array.isArray(payload.response) ? payload.response : [];
        const fixture = fixtureById.get(fixtureId);
        if (fixture) fixture.statistics = statistics;
      } catch (error) {
        console.warn(`Failed to load fixture statistics for settlement (${fixtureId})`, error);
      }
    }),
  );

  return fixtureById;
};

export type RetailTicketSettlementOutcome = {
  ticketId: string;
  attempted: boolean;
  settled: boolean;
  outcome?: 'won' | 'lost' | 'void' | 'unresolved';
  payout?: number | null;
  reason?: string;
};

export const settleRetailTicketIfDecidable = async (
  ticketId: string,
): Promise<RetailTicketSettlementOutcome> => {
  const ticket = await getRetailTicketByTicketId(ticketId);
  if (!ticket) {
    return {
      ticketId,
      attempted: false,
      settled: false,
      reason: 'ticket not found',
    };
  }

  if (!SETTLEABLE_RETAIL_TICKET_STATUSES.has(ticket.status)) {
    return {
      ticketId,
      attempted: false,
      settled: false,
      reason: `ticket status ${ticket.status} is not settleable`,
    };
  }

  if (ticket.bet.status !== 'pending') {
    return {
      ticketId,
      attempted: false,
      settled: false,
      reason: `bet already ${ticket.bet.status}`,
    };
  }

  const fixtureIds = Array.from(
    new Set(
      ticket.bet.selections
        .map((selection) => toFiniteNumber(selection.fixtureId))
        .filter((value): value is number => value !== null && value > 0),
    ),
  );

  if (fixtureIds.length === 0) {
    return {
      ticketId,
      attempted: false,
      settled: false,
      reason: 'no fixture ids on bet selections',
    };
  }

  const marketBetIds = new Set(
    ticket.bet.selections
      .map((selection) => String(selection.marketBetId ?? '').trim())
      .filter((value) => value.length > 0),
  );
  const marketNameByBetId = await loadMarketNames(marketBetIds);

  const selectionsForSettlement: SelectionSettlementInput[] = ticket.bet.selections.map(
    (selection) => {
      const fixtureId = toFiniteNumber(selection.fixtureId) ?? 0;
      const marketBetId = String(selection.marketBetId ?? '').trim();
      return {
        fixtureId,
        marketBetId: marketBetId || undefined,
        marketName: marketNameByBetId.get(marketBetId),
        value: String(selection.value ?? ''),
        handicap: selection.handicap,
        odd: selection.odd,
      };
    },
  );

  const fixtureIdsNeedingEvents = new Set<number>();
  const fixtureIdsNeedingStatistics = new Set<number>();
  for (const selection of selectionsForSettlement) {
    const fixtureId = toFiniteNumber(selection.fixtureId);
    if (fixtureId === null || fixtureId <= 0) continue;
    const marketName = String(selection.marketName ?? '');
    if (shouldFetchEventsForMarket(marketName)) {
      fixtureIdsNeedingEvents.add(fixtureId);
    }
    if (shouldFetchStatisticsForMarket(marketName)) {
      fixtureIdsNeedingStatistics.add(fixtureId);
    }
  }

  const fixtureById = await loadFixtureContexts(
    fixtureIds,
    fixtureIdsNeedingEvents,
    fixtureIdsNeedingStatistics,
  );

  const stake = toFiniteNumber(ticket.bet.stake) ?? 0;
  const resolved = resolveBetOutcome(selectionsForSettlement, fixtureById, stake);

  if (resolved.outcome === 'unresolved') {
    return {
      ticketId,
      attempted: true,
      settled: false,
      outcome: 'unresolved',
      payout: null,
      reason: resolved.lines.find((line) => line.result.outcome === 'unresolved')?.result.reason,
    };
  }

  const payout =
    resolved.payout ??
    (resolved.outcome === 'lost'
      ? 0
      : stake);

  const updatedBet = await updateBetSettlement(ticket.bet.id, {
    status: resolved.outcome,
    result: resolved.outcome,
    payout,
  });
  if (!updatedBet) {
    return {
      ticketId,
      attempted: true,
      settled: false,
      outcome: resolved.outcome,
      payout,
      reason: 'bet settlement update failed',
    };
  }

  await settleRetailTicketByBet({
    betId: ticket.bet.id,
    result: resolved.outcome,
    payout,
  });

  return {
    ticketId,
    attempted: true,
    settled: true,
    outcome: resolved.outcome,
    payout,
  };
};

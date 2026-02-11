import type { DbBetSelectionSelect } from '../db/schema/betSelections';
import type { ApiBetMode, ApiBetSelectionInput } from '../validation/bets';

type StoredSelection = Pick<
  DbBetSelectionSelect,
  'fixtureId' | 'marketBetId' | 'value' | 'odd' | 'handicap' | 'bookmakerId'
>;

export type StoredBetLine = {
  stake: string | number;
  selections: StoredSelection[];
};

export type RecreatedSlip = {
  stake: number;
  mode: ApiBetMode;
  systemSize?: number;
  selections: ApiBetSelectionInput[];
};

const round2 = (value: number): number => Number(value.toFixed(2));

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const toNumberOrString = (value: string | null): number | string | undefined => {
  if (value === null || value.length === 0) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

const normalizeSelectionKey = (selection: StoredSelection): string => {
  return [
    selection.fixtureId,
    selection.marketBetId ?? '',
    selection.value,
    selection.handicap ?? '',
    selection.bookmakerId ?? '',
  ].join('|');
};

export const normalizeBookCodeRoot = (ticketId: string): string => {
  const trimmed = ticketId.trim();
  const match = trimmed.match(/^(\d{2}-\d{6})(?:-\d+)?$/);
  return match?.[1] ?? trimmed;
};

const inferMode = (lines: StoredBetLine[]): { mode: ApiBetMode; systemSize?: number } => {
  if (lines.length === 0) return { mode: 'single' };

  const selectionCounts = lines.map((line) => line.selections.length).filter((count) => count > 0);
  if (selectionCounts.length === 0) return { mode: 'single' };

  if (lines.length === 1) {
    return selectionCounts[0] <= 1 ? { mode: 'single' } : { mode: 'multiple' };
  }

  if (selectionCounts.every((count) => count === 1)) {
    return { mode: 'single' };
  }

  const candidateSize = selectionCounts.filter((count) => count > 1);
  const systemSize = Math.max(2, Math.min(...candidateSize));
  return { mode: 'system', systemSize };
};

export const rebuildSlipFromStoredLines = (lines: StoredBetLine[]): RecreatedSlip => {
  const deduped = new Map<string, StoredSelection>();
  for (const line of lines) {
    for (const selection of line.selections) {
      deduped.set(normalizeSelectionKey(selection), selection);
    }
  }

  const selections = Array.from(deduped.values())
    .map((selection): ApiBetSelectionInput => ({
      fixtureId: selection.fixtureId,
      betId: toNumberOrString(selection.marketBetId),
      value: selection.value,
      odd: toNumber(selection.odd),
      handicap: toNumberOrString(selection.handicap),
      bookmakerId: selection.bookmakerId ?? undefined,
    }))
    .sort((a, b) => {
      if (a.fixtureId !== b.fixtureId) return a.fixtureId - b.fixtureId;
      const aBet = String(a.betId ?? '');
      const bBet = String(b.betId ?? '');
      if (aBet !== bBet) return aBet.localeCompare(bBet);
      return a.value.localeCompare(b.value);
    });

  const totalStake = round2(lines.reduce((sum, line) => sum + toNumber(line.stake), 0));
  const modeInfo = inferMode(lines);

  return {
    stake: totalStake,
    mode: modeInfo.mode,
    systemSize: modeInfo.systemSize,
    selections,
  };
};

import type { BetMode } from '../types/backendSchemas';

type SelectionForCalc = {
  odd: number;
};

export type BetSlipPreviewLine = {
  key: string;
  selections: number;
  combinedOdds: number;
  stake: number;
  potentialReturn: number;
};

export type BetSlipPreview = {
  mode: BetMode;
  stake: number;
  totalStake: number;
  totalPotentialReturn: number;
  lineCount: number;
  lines: BetSlipPreviewLine[];
  error: string | null;
};

const round2 = (value: number): number => Number(value.toFixed(2));

const splitStake = (totalStake: number, parts: number): number[] => {
  const totalCents = Math.round(totalStake * 100);
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;
  return new Array(parts).fill(base).map((value, index) => {
    const withRemainder = value + (index < remainder ? 1 : 0);
    return withRemainder / 100;
  });
};

const productOdds = (selections: SelectionForCalc[]): number =>
  selections.reduce((acc, selection) => acc * selection.odd, 1);

const combinations = <T>(items: T[], size: number): T[][] => {
  if (size <= 0 || size > items.length) return [];
  if (size === items.length) return [items];
  if (size === 1) return items.map((item) => [item]);

  const result: T[][] = [];
  const path: T[] = [];

  const dfs = (start: number) => {
    if (path.length === size) {
      result.push([...path]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      path.push(items[i]);
      dfs(i + 1);
      path.pop();
    }
  };

  dfs(0);
  return result;
};

export const calculateBetSlipPreview = (input: {
  mode: BetMode;
  stake: number;
  selections: SelectionForCalc[];
  systemSize?: number;
}): BetSlipPreview => {
  const normalizedStake = round2(Math.max(0, input.stake));
  const selections = input.selections.filter(
    (selection) => Number.isFinite(selection.odd) && selection.odd > 0,
  );

  if (normalizedStake <= 0 || selections.length === 0) {
    return {
      mode: input.mode,
      stake: normalizedStake,
      totalStake: normalizedStake,
      totalPotentialReturn: 0,
      lineCount: 0,
      lines: [],
      error: null,
    };
  }

  if (input.mode === 'multiple') {
    if (selections.length < 2) {
      return {
        mode: input.mode,
        stake: normalizedStake,
        totalStake: normalizedStake,
        totalPotentialReturn: 0,
        lineCount: 0,
        lines: [],
        error: 'Need 2+ selections for multiple',
      };
    }

    const combinedOdds = productOdds(selections);
    const line: BetSlipPreviewLine = {
      key: 'line_1',
      selections: selections.length,
      combinedOdds: round2(combinedOdds),
      stake: normalizedStake,
      potentialReturn: round2(normalizedStake * combinedOdds),
    };

    return {
      mode: input.mode,
      stake: normalizedStake,
      totalStake: normalizedStake,
      totalPotentialReturn: line.potentialReturn,
      lineCount: 1,
      lines: [line],
      error: null,
    };
  }

  if (input.mode === 'single') {
    const stakes = splitStake(normalizedStake, selections.length);
    const lines = selections.map((selection, index) => ({
      key: `line_${index + 1}`,
      selections: 1,
      combinedOdds: round2(selection.odd),
      stake: stakes[index],
      potentialReturn: round2(stakes[index] * selection.odd),
    }));

    return {
      mode: input.mode,
      stake: normalizedStake,
      totalStake: normalizedStake,
      totalPotentialReturn: round2(
        lines.reduce((sum, line) => sum + line.potentialReturn, 0),
      ),
      lineCount: lines.length,
      lines,
      error: null,
    };
  }

  const systemSize = input.systemSize ?? 0;
  if (selections.length < 3 || systemSize < 2 || systemSize > selections.length) {
    return {
      mode: input.mode,
      stake: normalizedStake,
      totalStake: normalizedStake,
      totalPotentialReturn: 0,
      lineCount: 0,
      lines: [],
      error: 'Invalid system configuration',
    };
  }

  const comboSelections = combinations(selections, systemSize);
  const stakes = splitStake(normalizedStake, comboSelections.length);
  const lines = comboSelections.map((combo, index) => {
    const combinedOdds = productOdds(combo);
    return {
      key: `line_${index + 1}`,
      selections: combo.length,
      combinedOdds: round2(combinedOdds),
      stake: stakes[index],
      potentialReturn: round2(stakes[index] * combinedOdds),
    };
  });

  return {
    mode: input.mode,
    stake: normalizedStake,
    totalStake: normalizedStake,
    totalPotentialReturn: round2(
      lines.reduce((sum, line) => sum + line.potentialReturn, 0),
    ),
    lineCount: lines.length,
    lines,
    error: null,
  };
};

import type { ApiBetSelectionInput, ApiBetSlipInput, ApiBetMode } from '../validation/bets';

export type ExpandedBetLine = {
  key: string;
  mode: ApiBetMode;
  selections: ApiBetSelectionInput[];
  stake: number;
  potentialPayout: number;
};

const round2 = (value: number): number => Number(value.toFixed(2));

const combination = <T>(items: T[], size: number): T[][] => {
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

const splitStake = (totalStake: number, parts: number): number[] => {
  const totalCents = Math.round(totalStake * 100);
  const base = Math.floor(totalCents / parts);
  const remainder = totalCents % parts;
  const values = new Array(parts).fill(base).map((value, index) => {
    const withRemainder = value + (index < remainder ? 1 : 0);
    return withRemainder / 100;
  });
  return values;
};

const productOdds = (selections: ApiBetSelectionInput[]): number =>
  selections.reduce((acc, selection) => acc * selection.odd, 1);

export const expandBetSlipLines = (slip: ApiBetSlipInput): ExpandedBetLine[] => {
  if (slip.mode === 'multiple') {
    return [
      {
        key: 'line_1',
        mode: 'multiple',
        selections: slip.selections,
        stake: round2(slip.stake),
        potentialPayout: round2(slip.stake * productOdds(slip.selections)),
      },
    ];
  }

  if (slip.mode === 'single') {
    const stakes = splitStake(slip.stake, slip.selections.length);
    return slip.selections.map((selection, index) => ({
      key: `line_${index + 1}`,
      mode: 'single',
      selections: [selection],
      stake: stakes[index],
      potentialPayout: round2(stakes[index] * selection.odd),
    }));
  }

  const combos = combination(slip.selections, slip.systemSize!);
  const stakes = splitStake(slip.stake, combos.length);
  return combos.map((combo, index) => ({
    key: `line_${index + 1}`,
    mode: 'system',
    selections: combo,
    stake: stakes[index],
    potentialPayout: round2(stakes[index] * productOdds(combo)),
  }));
};

export const totalPotentialPayout = (lines: ExpandedBetLine[]): number =>
  round2(lines.reduce((acc, line) => acc + line.potentialPayout, 0));


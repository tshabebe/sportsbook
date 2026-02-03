import { config } from './config';

type Selection = {
  odd: number;
  value: string;
};

type RiskResult =
  | { ok: true }
  | { ok: false; code: string; message: string; context?: Record<string, unknown> };

export const checkStake = (stake: number): RiskResult => {
  if (stake < config.risk.minStake) {
    return {
      ok: false,
      code: 'MIN_STAKE',
      message: `Minimum stake is ${config.risk.minStake}`,
      context: { minStake: config.risk.minStake },
    };
  }
  if (stake > config.risk.maxStake) {
    return {
      ok: false,
      code: 'MAX_STAKE',
      message: `Maximum stake is ${config.risk.maxStake}`,
      context: { maxStake: config.risk.maxStake },
    };
  }
  return { ok: true };
};

export const checkOddsRange = (selections: Selection[]): RiskResult => {
  for (const selection of selections) {
    if (selection.odd < config.risk.minOdd || selection.odd > config.risk.maxOdd) {
      return {
        ok: false,
        code: 'ODDS_RANGE',
        message: `Odds must be between ${config.risk.minOdd} and ${config.risk.maxOdd}`,
        context: { minOdd: config.risk.minOdd, maxOdd: config.risk.maxOdd },
      };
    }
  }
  return { ok: true };
};

export const checkMaxPayout = (stake: number, selections: Selection[]): RiskResult => {
  const multiplier = selections.reduce((acc, s) => acc * s.odd, 1);
  const payout = Number((stake * multiplier).toFixed(2));
  if (payout > config.risk.maxPayout) {
    return {
      ok: false,
      code: 'MAX_PAYOUT',
      message: `Maximum payout is ${config.risk.maxPayout}`,
      context: { maxPayout: config.risk.maxPayout, payout },
    };
  }
  return { ok: true };
};

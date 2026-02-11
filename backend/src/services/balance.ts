type InsufficientBalanceResult = {
  ok: false;
  code: 'INSUFFICIENT_BALANCE';
  message: 'Insufficient balance';
  context: {
    availableBalance: number;
    requiredStake: number;
  };
};

type SufficientBalanceResult = {
  ok: true;
  balance: number;
};

export type BalanceCheckResult = SufficientBalanceResult | InsufficientBalanceResult;

const toNumberOrZero = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const extractWalletBalance = (profile: unknown): number => {
  if (!profile || typeof profile !== 'object') return 0;

  const record = profile as Record<string, unknown>;
  const userData =
    record.userData && typeof record.userData === 'object'
      ? (record.userData as Record<string, unknown>)
      : null;

  return toNumberOrZero(
    userData?.realBalance ??
      userData?.balance ??
      record.realBalance ??
      record.balance ??
      0,
  );
};

export const ensureSufficientBalance = (
  profile: unknown,
  stake: number,
): BalanceCheckResult => {
  const balance = extractWalletBalance(profile);
  if (balance < stake) {
    return {
      ok: false,
      code: 'INSUFFICIENT_BALANCE',
      message: 'Insufficient balance',
      context: {
        availableBalance: balance,
        requiredStake: stake,
      },
    };
  }

  return { ok: true, balance };
};

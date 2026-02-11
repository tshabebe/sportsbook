import { describe, expect, it } from 'vitest';
import { ensureSufficientBalance, extractWalletBalance } from '../../src/services/balance';

describe('balance service', () => {
  it('extracts realBalance first from wallet profile', () => {
    const balance = extractWalletBalance({
      userData: {
        balance: 80,
        realBalance: 125.55,
      },
    });
    expect(balance).toBe(125.55);
  });

  it('falls back to nested balance and then root balance', () => {
    expect(extractWalletBalance({ userData: { balance: 77.25 } })).toBe(77.25);
    expect(extractWalletBalance({ balance: 22.1 })).toBe(22.1);
  });

  it('normalizes invalid profile shapes to zero', () => {
    expect(extractWalletBalance(null)).toBe(0);
    expect(extractWalletBalance({ userData: { balance: 'not-a-number' } })).toBe(0);
  });

  it('returns insufficient balance error when stake exceeds available', () => {
    const check = ensureSufficientBalance({ userData: { realBalance: 40 } }, 50);
    expect(check).toEqual({
      ok: false,
      code: 'INSUFFICIENT_BALANCE',
      message: 'Insufficient balance',
      context: {
        availableBalance: 40,
        requiredStake: 50,
      },
    });
  });

  it('passes when balance covers stake', () => {
    const check = ensureSufficientBalance({ userData: { realBalance: 500 } }, 80);
    expect(check).toEqual({
      ok: true,
      balance: 500,
    });
  });
});

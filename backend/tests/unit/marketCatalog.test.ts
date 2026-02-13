import { describe, expect, it } from 'vitest';
import {
  validateMarketForPlacement,
  type MarketCatalogEntry,
} from '../../src/services/marketCatalog';
import { isMarketNameSupported } from '../../src/services/settlementResolver';

const buildCatalog = (entries: MarketCatalogEntry[]): Map<string, MarketCatalogEntry> =>
  new Map(entries.map((entry) => [entry.id, entry]));

describe('market placement validation', () => {
  it('accepts supported market ids', () => {
    const catalog = buildCatalog([
      { id: '1', name: 'Match Winner', supported: true },
    ]);

    const result = validateMarketForPlacement(1, catalog);
    expect(result.ok).toBe(true);
  });

  it('rejects missing market id', () => {
    const catalog = buildCatalog([
      { id: '1', name: 'Match Winner', supported: true },
    ]);

    const result = validateMarketForPlacement(undefined, catalog);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('MISSING_MARKET_ID');
  });

  it('rejects unknown market id', () => {
    const catalog = buildCatalog([
      { id: '1', name: 'Match Winner', supported: true },
    ]);

    const result = validateMarketForPlacement('9999', catalog);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('MARKET_NOT_SUPPORTED');
  });

  it('rejects blocked market id from catalog', () => {
    const catalog = buildCatalog([
      { id: '1', name: 'Match Winner', supported: true },
      { id: '23', name: 'Unknown Experimental Market', supported: false },
    ]);

    const result = validateMarketForPlacement('23', catalog);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('MARKET_NOT_SUPPORTED');
    expect(result.details).toEqual({
      marketId: '23',
      marketName: 'Unknown Experimental Market',
    });
  });
});

describe('market support matching', () => {
  it('marks core football markets as supported', () => {
    expect(isMarketNameSupported('Match Winner')).toBe(true);
    expect(isMarketNameSupported('Double Chance')).toBe(true);
    expect(isMarketNameSupported('Goals Over/Under')).toBe(true);
  });

  it('rejects unknown market names', () => {
    expect(isMarketNameSupported('Mystery Market Alpha Beta')).toBe(false);
  });

  it('supports previously blocked API-Football retail market labels', () => {
    const previouslyBlocked = [
      'Correct Score - First Half',
      'Correct Score - Second Half',
      'Scoring Draw',
      'Home team will score in both halves',
      'Away team will score in both halves',
      'Home Win/Over',
      'Home Win/Under',
      'Away Win/Over',
      'Away Win/Under',
      'Goal in 1-15 minutes',
      'Goal in 16-30 minutes',
      'Goal in 31-45 minutes',
      'Goal in 46-60 minutes',
      'Goal in 61-75 minutes',
      'Goal in 76-90 minutes',
      'Either Team Wins By 1 Goals',
      'Either Team Wins By 2 Goals',
      'Team Performances (Range)',
      'Late Goal (Range)',
      'Early Goal (Range)',
      'Which team will score the 1st goal?',
      'Home Not lose/Over',
      'Home Not lose/Under',
      'Away Not lose/Over',
      'Away Not lose/Under',
    ];

    for (const marketName of previouslyBlocked) {
      expect(isMarketNameSupported(marketName), marketName).toBe(true);
    }
  });
});

# Bet Slip Types: Single, Multiple & System

## Overview

A bet slip contains one or more selections. How those selections are processed depends on the bet type.

---

## 1. Single Bet

**Simplest bet type. Each selection is a separate bet.**

### How It Works

```
User selects: Arsenal to win @ 1.50
Stake: $100
Potential Win: $100 × 1.50 = $150
```

### If User Adds Multiple Selections

Each becomes its own independent bet:

| Selection | Odds | Stake | Potential Win |
|-----------|------|-------|---------------|
| Arsenal to win | 1.50 | $50 | $75 |
| Liverpool to win | 2.00 | $50 | $100 |

**Results are independent** — Arsenal losing doesn't affect Liverpool bet.

### Calculation

```typescript
function calculateSingleBets(selections: Selection[], totalStake: number) {
  const stakePerBet = totalStake / selections.length;
  
  return selections.map(s => ({
    fixture_id: s.fixture_id,
    bet_type: s.bet_type,
    odds: s.odds,
    stake: stakePerBet,
    potential_win: stakePerBet * s.odds
  }));
}
```

### Settlement

```typescript
// Each bet settled independently
for (const bet of singleBets) {
  const result = await fetchFixtureResult(bet.fixture_id);
  const outcome = determineOutcome(result);
  
  if (bet.bet_type === outcome) {
    user.balance += bet.stake * bet.odds;
    bet.status = "won";
  } else {
    bet.status = "lost";
  }
}
```

---

## 2. Multiple Bet (Accumulator/Parlay)

**All selections combined into ONE bet. ALL must win.**

### How It Works

```
Selections:
  - Arsenal to win @ 1.50
  - Liverpool to win @ 2.00
  - Chelsea to win @ 1.80

Combined Odds: 1.50 × 2.00 × 1.80 = 5.40
Stake: $100
Potential Win: $100 × 5.40 = $540
```

### Key Rule

**If ANY selection loses, the entire bet loses.**

| Arsenal | Liverpool | Chelsea | Result |
|---------|-----------|---------|--------|
| ✅ Win | ✅ Win | ✅ Win | **WIN $540** |
| ✅ Win | ✅ Win | ❌ Lose | **LOSE $100** |
| ❌ Lose | ✅ Win | ✅ Win | **LOSE $100** |

### Calculation

```typescript
function calculateMultipleBet(selections: Selection[], stake: number) {
  const combinedOdds = selections.reduce((acc, s) => acc * s.odds, 1);
  
  return {
    selections: selections.map(s => ({
      fixture_id: s.fixture_id,
      bet_type: s.bet_type,
      odds: s.odds
    })),
    combined_odds: combinedOdds,
    stake: stake,
    potential_win: stake * combinedOdds
  };
}
```

### Settlement

```typescript
async function settleMultipleBet(betSlip) {
  const results = await fetchAllResults(betSlip.selections);
  
  // Check if ALL selections won
  const allWon = betSlip.selections.every(s => {
    const result = results.get(s.fixture_id);
    return result && determineOutcome(result) === s.bet_type;
  });
  
  if (allWon) {
    user.balance += betSlip.stake * betSlip.combined_odds;
    betSlip.status = "won";
  } else {
    betSlip.status = "lost";
  }
}
```

---

## 3. System Bet

**All possible combinations of selections. Partial wins possible.**

### How It Works

With 3 selections, a "2/3 System" generates all possible 2-pick combinations:

```
Selections:
  - Arsenal (A) @ 1.50
  - Liverpool (B) @ 2.00
  - Chelsea (C) @ 1.80

2/3 System creates 3 bets:
  - Combo 1: A + B → 1.50 × 2.00 = 3.00
  - Combo 2: A + C → 1.50 × 1.80 = 2.70
  - Combo 3: B + C → 2.00 × 1.80 = 3.60

Total stake $100 split: $33.33 per combo
```

### Key Benefit

**You can win even if not all selections succeed:**

| Arsenal | Liverpool | Chelsea | Combo 1 | Combo 2 | Combo 3 | Return |
|---------|-----------|---------|---------|---------|---------|--------|
| ✅ | ✅ | ✅ | ✅ $100 | ✅ $90 | ✅ $120 | **$310** |
| ✅ | ✅ | ❌ | ✅ $100 | ❌ | ❌ | **$100** |
| ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | **$0** |

### Common System Types

| System | Picks | Combo Size | # of Bets |
|--------|-------|------------|-----------|
| 2/3 | 3 | 2 | 3 |
| 2/4 | 4 | 2 | 6 |
| 3/4 | 4 | 3 | 4 |
| 2/5 | 5 | 2 | 10 |
| 3/5 | 5 | 3 | 10 |

### Formula

Number of combinations = n! / (k! × (n-k)!)

Where n = picks, k = combo size

### Calculation

```typescript
// Generate all combinations of size k from array
function getCombinations<T>(arr: T[], k: number): T[][] {
  if (k === 1) return arr.map(el => [el]);
  if (k === arr.length) return [arr];
  
  const result: T[][] = [];
  
  for (let i = 0; i <= arr.length - k; i++) {
    const head = arr[i];
    const tailCombos = getCombinations(arr.slice(i + 1), k - 1);
    
    for (const combo of tailCombos) {
      result.push([head, ...combo]);
    }
  }
  
  return result;
}

function calculateSystemBet(
  selections: Selection[], 
  comboSize: number, 
  totalStake: number
) {
  const combos = getCombinations(selections, comboSize);
  const stakePerCombo = totalStake / combos.length;
  
  return {
    system_type: `${comboSize}/${selections.length}`,
    total_stake: totalStake,
    combinations: combos.map(combo => ({
      selections: combo,
      combined_odds: combo.reduce((acc, s) => acc * s.odds, 1),
      stake: stakePerCombo,
      potential_win: stakePerCombo * combo.reduce((acc, s) => acc * s.odds, 1)
    }))
  };
}
```

### Example Output

```javascript
calculateSystemBet([
  { fixture_id: 1, bet_type: "Home", odds: 1.50 },  // Arsenal
  { fixture_id: 2, bet_type: "Home", odds: 2.00 },  // Liverpool
  { fixture_id: 3, bet_type: "Home", odds: 1.80 }   // Chelsea
], 2, 100);

// Output:
{
  system_type: "2/3",
  total_stake: 100,
  combinations: [
    { 
      selections: [Arsenal, Liverpool], 
      combined_odds: 3.00, 
      stake: 33.33, 
      potential_win: 100 
    },
    { 
      selections: [Arsenal, Chelsea], 
      combined_odds: 2.70, 
      stake: 33.33, 
      potential_win: 90 
    },
    { 
      selections: [Liverpool, Chelsea], 
      combined_odds: 3.60, 
      stake: 33.33, 
      potential_win: 120 
    }
  ]
}
```

### Settlement

```typescript
async function settleSystemBet(betSlip) {
  const results = await fetchAllResults(betSlip.selections);
  let totalReturn = 0;
  
  for (const combo of betSlip.combinations) {
    // Check if ALL selections in THIS combo won
    const comboWon = combo.selections.every(s => {
      const result = results.get(s.fixture_id);
      return result && determineOutcome(result) === s.bet_type;
    });
    
    if (comboWon) {
      totalReturn += combo.stake * combo.combined_odds;
      combo.status = "won";
    } else {
      combo.status = "lost";
    }
  }
  
  user.balance += totalReturn;
  betSlip.total_return = totalReturn;
  betSlip.status = totalReturn > 0 ? "partial_win" : "lost";
}
```

---

## Database Schema

```sql
-- Main bet slip
CREATE TABLE bet_slips (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  bet_type VARCHAR(20) NOT NULL,  -- 'single', 'multiple', 'system'
  system_type VARCHAR(10),         -- '2/3', '3/4', etc. (only for system)
  total_stake DECIMAL(10,2) NOT NULL,
  total_potential_win DECIMAL(10,2),
  total_return DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Selections (picks) in the slip
CREATE TABLE bet_selections (
  id UUID PRIMARY KEY,
  bet_slip_id UUID REFERENCES bet_slips(id),
  fixture_id INTEGER NOT NULL,
  bet_type VARCHAR(10) NOT NULL,
  odds DECIMAL(5,2) NOT NULL,
  result VARCHAR(10)
);

-- Individual bets (for single) or combinations (for system)
CREATE TABLE bet_lines (
  id UUID PRIMARY KEY,
  bet_slip_id UUID REFERENCES bet_slips(id),
  stake DECIMAL(10,2) NOT NULL,
  combined_odds DECIMAL(10,2),
  potential_win DECIMAL(10,2),
  actual_return DECIMAL(10,2),
  status VARCHAR(20) DEFAULT 'pending'
);

-- Selections in each bet line
CREATE TABLE bet_line_selections (
  bet_line_id UUID REFERENCES bet_lines(id),
  selection_id UUID REFERENCES bet_selections(id),
  PRIMARY KEY (bet_line_id, selection_id)
);
```

---

## API Endpoint Example

```typescript
// POST /api/bets
{
  "bet_type": "system",
  "system_type": "2/3",
  "total_stake": 100,
  "selections": [
    { "fixture_id": 1379211, "bet_type": "Home", "odds": 1.50 },
    { "fixture_id": 1379212, "bet_type": "Draw", "odds": 3.20 },
    { "fixture_id": 1379213, "bet_type": "Away", "odds": 2.10 }
  ]
}
```

---

## Summary

| Type | Selections | Stake Split | All Must Win? | Partial Win? |
|------|------------|-------------|---------------|--------------|
| **Single** | 1+ | Per selection | N/A | Yes (each independent) |
| **Multiple** | 2+ | One bet | Yes | No |
| **System** | 3+ | Per combo | Per combo | Yes |

---

## Implementation Order

1. ✅ **Single** — Start here, simplest
2. ✅ **Multiple** — Just multiply odds
3. ✅ **System** — Add combination generator

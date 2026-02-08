# Bet Slip Types And Verification

## Source Of Truth

- Request validation is in `backend/src/validation/bets.ts`.
- Drizzle schemas are in `backend/src/db/schema/bets.ts` and `backend/src/db/schema/betSelections.ts`.
- Bet verification/place routes are in `backend/src/routes/bets.ts`.

## Bet Slip Types (Current)

### Selection payload

```ts
{
  fixtureId: number; // required, int, > 0
  betId?: number | string;
  value: string; // outcome label, e.g. Home/Draw/Away
  odd: number; // required, > 0
  handicap?: number | string;
  bookmakerId?: number; // int
}
```

### Bet slip payload

```ts
{
  selections: Selection[]; // at least 1
  stake: number; // > 0
}
```

### Settlement payload

```ts
{
  result: "won" | "lost" | "void";
  payout?: number; // >= 0
}
```

All payloads are strict Zod objects and reject unknown keys.

## Verification Flow (Current)

### 1) `POST /api/betslip/validate`

For each selection:
- Fetch fresh odds snapshot from `/api/football/odds?fixture={fixtureId}`.
- Fetch fixture status from `/api/football/fixtures?id={fixtureId}`.
- Reject if fixture is in-play or finished.
- Match selected market/outcome/odd against snapshot.
- Reject if market missing, odd changed, or suspended.
- Compute projected exposure and reject if limit exceeded.

Response:
- `{ ok: true, results: [...] }` if all selections pass.
- `{ ok: false, results: [...] }` with per-selection errors otherwise.

### 2) `POST /api/betslip/place`

- Re-runs the same validation path as above.
- Debits wallet.
- Persists `bets` and `bet_selections` through Drizzle.
- If DB write fails after debit, runs compensating wallet credit.

### 3) `POST /api/bets/:id/settle`

- Validates settlement payload with Zod.
- Ensures bet exists and is still `pending`.
- If `result === "won"` and `payout > 0`, credits wallet.
- Updates bet settlement fields (`status`, `result`, `payout`, `walletCreditTx`, `settledAt`).

## Drizzle Data Model (Current)

### `bets`
- `id`, `betRef`, `userId`, `username`, `stake`, `status`
- `walletDebitTx`, `walletCreditTx`
- `payout`, `result`, `settledAt`, `createdAt`

### `bet_selections`
- `id`, `betId`, `fixtureId`
- `marketBetId`, `value`, `odd`, `handicap`, `bookmakerId`, `createdAt`

No runtime raw SQL schema creation is used; schema changes must go through Drizzle migrations.

| status.short | Meaning | Action |
|--------------|---------|--------|
| `NS` | Not Started | Wait |
| `1H` | First Half | Wait |
| `HT` | Half Time | Wait |
| `2H` | Second Half | Wait |
| `FT` | Full Time | **Settle** |
| `AET` | After Extra Time | **Settle** |
| `PEN` | Penalties | **Settle** |
| `PST` | Postponed | Refund |
| `CANC` | Cancelled | Refund |
| `ABD` | Abandoned | Refund |

---

## Summary

1. **Store** fixture_id + bet_type + odds when user bets
2. **Poll** for results using `/fixtures?ids=X-Y-Z`
3. **Determine** outcome using `teams.home.winner` / `teams.away.winner`
4. **Settle** bet and update user balance
5. **Verify** historical odds if needed for auditing

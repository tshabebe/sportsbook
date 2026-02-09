# Player vs Retail Domain and API Contract

## Goal

Define two clearly distinct flows so users are never confused:

1. `Player Ticket Flow` (anonymous, no login, no wallet UI)
2. `Retail POS Flow` (cashier login, claim + payout only)

Both flows use the same ticket lifecycle in backend.

---

## Domain Model

## Actors

- `Player (Anonymous)`
  - Can create ticket online.
  - Receives `ticketId`/batch id.
  - Can check ticket status.
  - Cannot claim/payout.

- `Retailer (Authenticated)`
  - Can login with username/password.
  - Can lookup ticket.
  - Can claim ticket ownership.
  - Can payout only claimed + won-unpaid tickets.

- `System`
  - Settles bet result.
  - Moves ticket state according to settlement.

## Entities

- `Bet` (`bets`)
  - Stores stake, status/result, payout, channel.
  - For retail channel, each ticket line creates one bet record.

- `Retail Ticket` (`retail_tickets`)
  - `ticketId` (printable human code)
  - ownership fields (`claimedByRetailerId`, `claimedAt`)
  - payout fields (`paidByRetailerId`, `paidAt`, `payoutAmount`)
  - lifecycle state (`open`, `claimed`, `settled_won_unpaid`, `settled_lost`, `paid`, `void`, `expired`)

- `Retail Ticket Event` (`retail_ticket_events`)
  - immutable audit log for compliance/disputes

---

## Lifecycle

1. `Player creates ticket` -> `open`
2. `Retailer claims ticket` -> `claimed`
3. `System settles bet`
   - won -> `settled_won_unpaid`
   - lost -> `settled_lost`
   - void -> `void`
4. `Retailer pays ticket` -> `paid`

Rules:
- Claim is first-writer-wins (atomic).
- Payout only by claimed owner.
- Payout idempotent by `payoutReference` + state.

---

## API Contract

All responses use:

```json
{ "ok": true, "...": "..." }
```

or

```json
{ "ok": false, "error": { "code": "SOME_CODE", "message": "..." } }
```

## Player Ticket Flow (Public)

### 1) Create ticket

`POST /api/tickets`

Payload:
- Same as `betSlipSchema` (`mode`, `stake`, `selections`, optional `systemSize`)

Behavior:
- Validates risk + odds snapshot.
- Creates one or more retail tickets (line-based for single/system).

Response fields:
- `ticketBatchId`, `mode`, `totalStake`, `totalPotentialPayout`, `lineCount`
- `tickets[]` with ticket ids and expiry
- `bets[]` line bets

Compatibility alias:
- `POST /api/betslip/place-retail` (same behavior)

### 2) Track ticket status

`GET /api/tickets/:ticketId`

Response:
- `ticket` (status + ownership + payout metadata)
- `bet` (status, stake, payout, settledAt)

This endpoint is player-safe and does not expose retailer auth actions.

## Retail POS Flow (Authenticated)

### 1) Retailer login

`POST /api/retail/auth/login`

Returns:
- retailer token
- retailer identity

### 2) Lookup ticket

`GET /api/retail/tickets/:ticketId`

### 3) Claim ticket

`POST /api/retail/tickets/:ticketId/claim`
Auth:
- `Authorization: Bearer <retailer-token>`

### 4) Payout ticket

`POST /api/retail/tickets/:ticketId/payout`
Auth:
- `Authorization: Bearer <retailer-token>`
Payload:
- `payoutReference`

### 5) List my tickets

`GET /api/retail/my/tickets?status=...`
Auth:
- `Authorization: Bearer <retailer-token>`

---

## Frontend Split Contract

## `/play/*` (Player UI)

- No login requirement.
- No balance/deposit UI.
- Primary CTA is `Create Ticket`.
- Secondary CTA: `Track Ticket`.
- Must never show `Claim` or `Payout` actions.

## `/retail/*` (Retail POS UI)

- Requires retailer login.
- Primary workflow: `Lookup -> Claim -> Payout`.
- Must never show player betting UI.
- Must always show operator identity + mode badge.

---

## Migration Plan (UI)

1. Add route groups:
   - `/play`
   - `/retail`
2. Create separate layouts (visual + navigation separation).
3. Add route guards:
   - retailer token required for `/retail/*`
4. Remove cross-mode actions from each mode UI.
5. Add E2E lifecycle test:
   - create ticket -> claim -> settle -> payout


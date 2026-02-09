# Retail Ticket Contract (Online-Issued, Retailer-Claimed)

## Scope

This contract adds a second channel to the existing betting system:

1. Anonymous player creates a ticket online.
2. Ticket is initially unclaimed.
3. Retailer claims ownership of the ticket.
4. Retailer pays out only tickets they claimed.

Online wallet-user flow remains unchanged.

---

## Core Model

### Channel

`bets.channel`:
- `online_wallet`
- `online_retail_ticket`

### Ticket Ownership Rule

- Ticket is created by website (not cashier).
- Only one retailer can claim a ticket.
- Only the claiming retailer can pay that ticket.

---

## Database Schema (Drizzle-Level)

## 1) `retailers`

Purpose: shop operators that can claim/payout tickets.

Fields:
- `id` `bigserial` PK
- `name` `text` not null
- `username` `text` unique not null
- `password_hash` `text` not null
- `is_active` `boolean` not null default `true`
- `created_at` `timestamptz` not null default now

Indexes:
- unique index on `username`

## 2) `retail_tickets`

Purpose: ticket metadata and ownership/payout lifecycle.

Fields:
- `id` `bigserial` PK
- `ticket_id` `text` unique not null (human printable ID)
- `channel` `text` not null default `online_retail_ticket`
- `status` `text` not null
  - `open`
  - `claimed`
  - `settled_lost`
  - `settled_won_unpaid`
  - `paid`
  - `void`
  - `expired`
- `bet_id` `bigint` not null references `bets.id`
- `claimed_by_retailer_id` `bigint` null references `retailers.id`
- `claimed_at` `timestamptz` null
- `paid_by_retailer_id` `bigint` null references `retailers.id`
- `paid_at` `timestamptz` null
- `payout_amount` `numeric(12,2)` null
- `payout_reference` `text` null unique (idempotency ref)
- `expires_at` `timestamptz` null
- `created_at` `timestamptz` not null default now

Indexes:
- unique index on `ticket_id`
- index on `status`
- index on `claimed_by_retailer_id`
- index on `bet_id`

## 3) `retail_ticket_events` (audit trail)

Purpose: immutable timeline for compliance and disputes.

Fields:
- `id` `bigserial` PK
- `ticket_id` `text` not null references `retail_tickets.ticket_id`
- `event_type` `text` not null
  - `created`
  - `claimed`
  - `settled_won`
  - `settled_lost`
  - `paid`
  - `voided`
  - `expired`
- `actor_type` `text` not null (`system` | `retailer`)
- `actor_id` `text` null
- `payload_json` `jsonb` null
- `created_at` `timestamptz` not null default now

Indexes:
- index on `ticket_id`
- index on `event_type`

## 4) Optional changes to `bets`

Add nullable fields:
- `channel` `text` default `online_wallet`
- `ticket_id` `text` null unique references `retail_tickets.ticket_id`

---

## Lifecycle State Machine

1. `open`  
Created online, no retailer assigned.

2. `claimed`  
Assigned to one retailer (`claimed_by_retailer_id` set once).

3. Settled result:
- `settled_lost` (no payout)
- `settled_won_unpaid` (ready for retailer payout)

4. `paid`  
Final; cannot transition again.

Terminal exception states:
- `void`
- `expired`

Illegal transitions (must reject):
- claim when already claimed
- pay when not `settled_won_unpaid`
- pay by non-owner retailer
- pay twice

---

## API Contracts

All retailer endpoints require retailer auth token (separate from wallet-user token).

### 1) Retailer Login

`POST /api/retail/auth/login`

Request:
```json
{
  "username": "retailer_a",
  "password": "secret"
}
```

Response:
```json
{
  "ok": true,
  "token": "<retailer-jwt>",
  "retailer": {
    "id": 12,
    "name": "Shop A",
    "username": "retailer_a"
  }
}
```

### 2) Ticket Lookup (public in retailer portal)

`GET /api/retail/tickets/:ticketId`

Response:
```json
{
  "ok": true,
  "ticket": {
    "ticketId": "TK-93F2-1C",
    "status": "open",
    "claimedByRetailerId": null,
    "bet": {
      "id": 1281,
      "stake": "100.00",
      "potentialPayout": "325.00",
      "selections": []
    }
  }
}
```

### 3) Claim Ticket

`POST /api/retail/tickets/:ticketId/claim`

Rules:
- only `open` ticket can be claimed
- first claim wins (atomic compare-and-set update)

Response:
```json
{
  "ok": true,
  "ticket": {
    "ticketId": "TK-93F2-1C",
    "status": "claimed",
    "claimedByRetailerId": 12,
    "claimedAt": "2026-02-09T11:00:00.000Z"
  }
}
```

### 4) Payout Ticket

`POST /api/retail/tickets/:ticketId/payout`

Request:
```json
{
  "payoutReference": "retailer-12-tk93f2-001"
}
```

Rules:
- ticket must be `settled_won_unpaid`
- caller must equal `claimed_by_retailer_id`
- idempotent by `payoutReference` and ticket status

Response:
```json
{
  "ok": true,
  "ticket": {
    "ticketId": "TK-93F2-1C",
    "status": "paid",
    "paidByRetailerId": 12,
    "paidAt": "2026-02-09T11:25:00.000Z",
    "payoutAmount": "325.00"
  }
}
```

### 5) Retailer-Owned Tickets List

`GET /api/retail/my/tickets?status=claimed|settled_won_unpaid|paid`

Returns only tickets where `claimed_by_retailer_id = auth.retailerId`.

---

## Zod DTOs (Suggested)

Retail auth:
- `retailerLoginSchema`

Retail claim/payout:
- `retailClaimTicketParamsSchema`
- `retailPayoutSchema` (`payoutReference`)

Retail ticket responses:
- `retailTicketSchema`
- `retailTicketStatusEnum`

---

## Concurrency And Safety

1. Claim must be atomic:
- SQL condition `status='open' AND claimed_by_retailer_id IS NULL`

2. Payout must be atomic:
- SQL condition `status='settled_won_unpaid' AND claimed_by_retailer_id=:retailerId`

3. Add idempotency:
- unique `payout_reference`

4. Always append audit event row on each transition.

---

## Settlement Integration

When current settlement logic finishes a retail ticket bet:

1. If bet won:
- set ticket status `settled_won_unpaid`
- set payout amount
- append `settled_won` event

2. If bet lost:
- set ticket status `settled_lost`
- append `settled_lost` event

No retailer payout happens automatically in settlement; payout is retailer action.


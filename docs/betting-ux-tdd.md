# Betting UX Contract and TDD

## Goal
Ship a betting flow that is intuitive for guests and logged-in users, with clear actions in each area:
- Sidebar: discover and filter what to bet on.
- Main board: scan fixtures and pick selections fast.
- Bet area (bet slip): review risk, then execute one primary action.

## User-Centered Flow
1. Discover
  - User lands on `/play`.
  - Sidebar explains the 3-step flow.
  - User filters by league and/or date without blocking the whole page.
2. Select
  - User taps odds in the main board.
  - Bet slip updates instantly with selected outcomes.
  - One outcome per fixture+market is active at a time.
3. Review
  - Bet slip shows type, line count, stake, potential returns.
  - User can switch `single` / `multiple` / `system`.
4. Execute
  - Guest sees primary CTA `Book a Bet`.
  - Logged-in user sees primary CTA `Place Bet`.
  - Guest booking returns a short booking code (`DD-NNNNNN`) for copy/share.
  - Shared link opens betslip and recreates selections from booking code.
  - Logged-in place flow debits wallet and returns bet reference.
5. Track
  - User can open tracker with booking code/ticket ID to check lifecycle.

## Area Expectations

### Sidebar
- Must communicate purpose, not only navigation.
- Must support league search and league counters.
- Must keep `Track Ticket` discoverable at all times.
- Must not freeze while waiting for all leagues to finish loading.

### Main Board
- Must show fixtures progressively as data arrives.
- Must make primary odds actions obvious and consistent.
- Must preserve user context while filtering (league/date/search).
- Must show clear states for loading, empty, and API failure.

### Bet Area (Bet Slip)
- Must show a single primary action to avoid confusion:
  - guest: `Book a Bet`
  - logged in: `Place Bet`
- Must clearly indicate stake, potential returns, and line count before submission.
- Must surface validation errors in plain language.
- Must provide actionable success output:
  - booking code for guest
  - bet reference for logged-in

## TDD Plan

### Frontend E2E (Cypress)
`frontend/cypress/e2e/betslip.cy.ts`
- Guest flow:
  - Given no auth token, primary CTA is `Book a Bet`.
  - On submit, UI shows `Bet Booked` and short book code.
- Logged-in flow:
  - Given auth token and balance, primary CTA is `Place Bet`.
  - On submit, UI shows wallet success reference.
- Logged-in insufficient balance:
  - Given low balance, place call is blocked client-side.

### Backend Unit
`backend/tests/unit/bookCode.test.ts`
- `generateRetailBookCode()` returns `DD-NNNNNN` format.
- deterministic generation can be asserted by injecting date/random.

### Backend Integration
`backend/tests/integration/retail.flow.live.test.ts`
- Retail login, claim ownership, payout authorization, idempotent payout.
- Rejection of historical/live-in-play ticket placements.

## Definition of Done
- Cypress betslip scenarios pass.
- Backend unit tests pass.
- Retail live flow test passes with `RUN_LIVE_TESTS=1`.
- UX labels and primary actions match auth state.
- Guest booking result is a short code suitable for copy/share.

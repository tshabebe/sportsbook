# Sportsbook UI → API Flow

This is a realistic navigation flow for a sportsbook UI and the exact endpoints the UI calls at each step.

## 1) Home / Popular Leagues
Purpose: show top leagues + quick access.

Endpoints:

- `GET /api/football/leagues/popular`
- (optional) `GET /api/football/leagues/with-odds` to show only leagues with odds

## 2) League Page (fixtures list)
Purpose: show upcoming matches for a league.

Endpoints:

- `GET /api/football/fixtures?league={id}&season={season}&next=20`
- (optional) `GET /api/football/standings?league={id}&season={season}`
- (optional) `GET /api/football/fixtures/rounds?league={id}&season={season}`

## 3) Match Card (quick odds)
Purpose: show 1X2 or quick picks on cards.

Endpoints:

- `GET /api/football/odds?fixture={fixtureId}`

UI note: show the first bookmaker’s Match Winner market.

## 4) Match Detail Page (pre‑match)
Purpose: show full markets + context.

Endpoints:

- `GET /api/markets/{fixtureId}` (normalized markets for the UI)
- `GET /api/football/fixtures?ids={fixtureId}`
- `GET /api/football/standings?league={id}&season={season}`
- `GET /api/football/fixtures/headtohead?h2h={team1Id}-{team2Id}`
- `GET /api/football/injuries?league={id}&season={season}&team={teamId}`
- `GET /api/football/fixtures/lineups?fixture={fixtureId}` (only close to kickoff)
- `GET /api/football/predictions?fixture={fixtureId}` (optional insight)

## 5) Live Tab
Purpose: list live matches + live odds.

Endpoints:

- `GET /api/football/fixtures/live` (or `.../fixtures/live?league=39`)
- `GET /api/football/odds/live` (or `.../odds/live?league=39`)

## 6) Live Match Page
Purpose: live stats + live odds.

Endpoints:

- `GET /api/football/fixtures/statistics?fixture={fixtureId}`
- `GET /api/football/fixtures/events?fixture={fixtureId}`
- `GET /api/football/odds/live?fixture={fixtureId}`
- `GET /api/markets/{fixtureId}` (optional, for live market cards)

## 7) Bet Slip (validate)
Purpose: confirm odds are still valid.

Endpoints:

- `POST /api/betslip/validate`

## 8) Place Bet
Purpose: debit wallet + create bet.

Endpoints:

- `POST /api/betslip/place`

## 9) My Bets (history + pending)
Purpose: user sees their tickets.

Endpoints:

- `GET /api/bets`

## 10) Bet Detail
Purpose: see a single ticket.

Endpoints:

- `GET /api/bets/{id}`

## Optional: League Page Bundle
If you want a single call instead of multiple ones, see `backend/LEAGUE_BUNDLE.md`.

# League Page Bundle Endpoint

Purpose: reduce UI API calls by returning all league page data in one request.

## Endpoint

```
GET /api/league/{leagueId}/bundle?season=YYYY&next=20
```

## What it returns

- Fixtures (upcoming or recent)
- Standings
- Rounds (matchweeks / competition phases)
- Optional: quick odds per fixture (if enabled)

## Why this exists

Normally the UI needs multiple calls:

- `GET /api/football/fixtures?league={id}&season={season}&next=20`
- `GET /api/football/standings?league={id}&season={season}`
- `GET /api/football/fixtures/rounds?league={id}&season={season}`
- `GET /api/football/odds?fixture={fixtureId}` (per fixture)

The bundle collapses those into one call to:

```
GET /api/league/{leagueId}/bundle?season=YYYY&next=20
```

## Suggested response shape

```
{
  "ok": true,
  "league": { "id": 39, "name": "Premier League", "season": 2025 },
  "fixtures": [ ... ],
  "standings": { ... },
  "rounds": [ ... ],
  "odds": {
    "byFixtureId": {
      "1379199": [ ... ],
      "1379205": [ ... ]
    }
  }
}
```

## Notes

- Use when building league pages and matchweek filters.
- Helps UI performance and reduces API-Football calls.
- If odds are omitted, the UI can still fetch them per fixture.

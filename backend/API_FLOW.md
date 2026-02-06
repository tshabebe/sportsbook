# Betting App Data Fetch Flow (Minimal Local Endpoints)

This is the definitive "Happy Path" data flow for your betting application.
**Base URL**: `http://localhost:3001/api/football`

## Step 1: Fetch Leagues
**Purpose**: Let users select which league or cup to view.
**Local Endpoint**:
```http
GET http://localhost:3001/api/football/leagues?current=true
```

**API Data Needed**:
*   `league.id` → Unique ID (e.g., 39 for Premier League)
*   `league.name` → Name
*   `country.name` → Country
*   `seasons[0].year` → Current season year

**Notes**:
*   Fetch once per day.
*   Filter client-side to remove leagues with old years if necessary.

---

## Step 2: Fetch Fixtures (Matches)
**Purpose**: Get the list of upcoming matches for the selected league.
**Local Endpoint**:
```http
GET http://localhost:3001/api/football/fixtures?league={league_id}&next=10
```
*(Example: `?league=39&next=10`)*

**API Data Needed**:
*   `fixture.id` → Unique Match ID (Use this for Step 3)
*   `teams.home` / `teams.away` → Names and Logo URLs
*   `fixture.date` → Start time
*   `fixture.status.short` → Status code (NS, LIVE, FT)

**Notes**:
*   **Season Agnostic**: Using `next=10` automatically finds the correct upcoming games regardless of the season year.
*   Access team logos directly from the `teams` object in this response.

---

## Step 3: Fetch Odds
**Purpose**: Get betting lines for the specific matches visible on screen.
**Local Endpoint**:
```http
GET http://localhost:3001/api/football/odds?fixture={fixture_id}
```
*(Example: `?fixture=1208137`)*

**API Data Needed**:
*   `bookmakers[0].bets[0].values` → Odds (Home/Draw/Away)

**Notes**:
*   Call this *in parallel* for each visible match from Step 2.
*   Backend caches this for 3 hours (pre-match) or 5 seconds (live).

---

## Step 4: Fetch Live Updates
**Purpose**: Update scores and game clocks for In-Play games.
**Local Endpoint**:
```http
GET http://localhost:3001/api/football/fixtures?live=all
```

**API Data Needed**:
*   `fixture.status.elapsed` → Minute
*   `goals.home` / `goals.away` → Live Score
*   `events` → Goals, Cards

**Notes**:
*   Poll this endpoint every 15 seconds.

---

## Summary Flow
1.  **Start**: Call `/leagues?current=true`.
2.  **Select**: UI calls `/fixtures?league=39&next=10`.
3.  **Merge**: UI calls `/odds?fixture=ID` for the matches returned.
4.  **Live**: Background poller calls `/fixtures?live=all`.

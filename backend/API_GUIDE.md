# API Proxy Guide

Your backend is now a **Smart Caching Proxy** for API-Football. This means the endpoints generally mirror the [API-Football Documentation](https://www.api-football.com/documentation-v3), but with built-in caching and API key management.

## Base URL
`http://localhost:3001/api/football`

## Core Endpoints

### 1. Fixtures (Matches)
Fetch schedules, results, or live games.
*   **Endpoint**: `/fixtures` (Full path: `/api/football/fixtures`)
*   **Proxy Mapping**: `v3.football.api-sports.io/fixtures`
*   **Cache TTL**: 15s (Live), 60s (Upcoming/Recent)

**Examples:**
```bash
# Get next 10 matches for Premier League (League 39)
GET /fixtures?league=39&next=10&status=NS

# Get Live Matches
GET /fixtures?live=all

# Get Matches for a specific date
GET /fixtures?date=2024-02-15
```

### 2. Odds
Fetch betting odds for fixtures.
*   **Endpoint**: `/odds`
*   **Proxy Mapping**: `v3.football.api-sports.io/odds`
*   **Cache TTL**: 3 Hours (Pre-match), 5s (Live)

**Examples:**
```bash
# Get pre-match odds for a specific fixture
GET /odds?fixture=123456

# Get LIVE odds (careful with rate limits, cached for 5s)
GET /odds/live
```

### 3. Leagues
Fetch available leagues.
*   **Endpoint**: `/leagues`
*   **Proxy Mapping**: `v3.football.api-sports.io/leagues`
*   **Cache TTL**: 1 Hour

**Examples:**
```bash
# Get all leagues
GET /leagues

# Search for a league
GET /leagues?search=premier
```

### 4. Special Routes
Optimized routes specific to your app.

*   **`/leagues/popular`**: Returns a static list of the top 12 leagues (Premier League, La Liga, etc.) instantly. Use this for the sidebar.

## Data Fetching Strategy (Frontend)

Since the `/fixtures/with-odds` aggregation route was removed for performance, you should use **Client-Side Composition**:

1.  **Fetch Schedule**: Call `/fixtures` to get the list of games.
2.  **Fetch Odds (Parallel)**: For the games you are displaying, call `/odds?fixture=ID` in parallel (or use the generic `/odds` endpoint if filtering allows).
3.  **Merge**: Combine the data in your frontend code.

**Example (React/TanStack Query):**
See `frontend/src/hooks/useFootball.ts` for the implementation of `usePreMatchFixtures` which demonstrates this pattern.

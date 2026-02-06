# Betting App Data Fetch Flow (Minimal Local Endpoints)

This is the definitive "Happy Path" data flow for your betting application.
**Base URL**: `http://localhost:3001/api/football`

## Step 1: Fetch Leagues
**Purpose**: Let users select which league or cup to view.
**Local Endpoint**:
```http
GET http://localhost:3001/api/football/leagues?current=true
```

we fetch this if a user wants to bet on more popular leagues. we provide a search functionlity for it so that it can bet on it.
**API Data Needed**:
*   `league.id` → Unique ID (e.g., 39 for Premier League)
*   `league.name` → Name
*   `country.name` → Country
*   `seasons[0].year` → Current season year

**Notes**:
*   Filter client-side to remove leagues with old years if necessary.

---

## Step 2: Fetch Fixtures (Matches)

You need to fetch two types of lists: **Pre-Match** (Upcoming) and **Live** (In-Play).

### A. Pre-Match (Upcoming)
**Local Endpoint**:
```http
GET http://localhost:3001/api/football/fixtures?league={league_id}&next=10
```
**Notes**:
*   Using `next=10` gets the immediate schedule.
*   **Pagination**: The `next` parameter acts as a limit (e.g., "Top 10").
    *   To "Load More", simply ask for more (e.g., `next=20`) and let client handle, OR
    *   Use date ranges: `from=YYYY-MM-DD&to=YYYY-MM-DD` for strict control.
*   **Conflict Warning**: You CANNOT use `live=all` and `next=10` together.
*   **Validation**: Check `fixture.status.short`.
    *   If `NS` or `TBD` → Show in "Upcoming".
    *   If `LIVE`, `1H`, etc. → Move to "Live" section.
*   The API automatically finds the correct season.

### B. Live (In-Play)
**Local Endpoint**:
```http
GET http://localhost:3001/api/football/fixtures?live=all
```
*(Or `?live={league_id}` to filter)*

**Notes**:
*   These matches are currently being played.
*   Use this for your "Live" tab.

**API Data Needed (For Both)**:
*   `fixture.id` → Unique Match ID
*   `teams.home` / `teams.away` → Names and Logos
*   `fixture.status.short` → **Status Code** (Critical for processing)
    *   **Pre-Match**: `NS` (Not Started), `TBD` (Time To Be Defined)
    *   **Live**: `1H`, `HT`, `2H`, `ET`, `PEN`, `LIVE`
    *   **Finished**: `FT`, `AET`, `PEN`
*   `goals` → Current score

**Status Code Reference**:
*   **NS**: Match hasn't started yet (Standard for upcoming).
*   **1H/2H**: First/Second Half.
*   **HT**: Halftime.
*   **FT**: Full Time (Finished).

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
*   **Best Practice**: do NOT filter by a specific bookmaker ID if relying on a 3rd party API.
    *   *Why?* API-Football aggregates data. If Bet365 is down/missing, you still want to show odds.
    *   **Strategy**: "Waterfall" preference. Check `bookmakers` array:
        1.  Is **Bet365** there? Use it.
        2.  Else, is **1xBet** there? Use it.
        3.  Else, use the first available one.
    *   This ensures 100% coverage while preferring your "Main" provider.

---

## Step 5: UI Implementation Strategy (Best Practice)

### A. The "Match Card" (List View)
**Goal**: Show quick info to get a user interested.
*   **What to show**:
    *   Time / Status (Live, 10:00 AM)
    *   Team Names + Logos
    *   **Primary Odds ONLY**: "Match Winner" (Home / Draw / Away).
*   **How to get it**:
    *   From the `odds` response, look for `bets.name === "Match Winner"`.
    *   Display the 3 values (`1`, `X`, `2`).

### B. The "Betting Detail" (Deep Dive Analysis)
I analyzed **10 major providers** (Bet365, DraftKings, 1xBet, FanDuel, William Hill, etc.).
**Consensus**: Do **NOT** use a basic Modal. It is too small for 100+ markets.

**The "Gold Standard" Pattern**:
1.  **Navigation**: **New Page** (`/match/:id`) or **Full-Screen Slide-over** (Mobile).
2.  **Organization (The "Tab" System)**:
    *   Do not list 50 markets in one scroll.
    *   Use **Horizontal Tabs/Pills** at the top: `[ Main ] [ Goals ] [ Halves ] [ Corners ] [ Cards ]`.
3.  **Layout (Accordions)**:
    *   Each market (e.g., "Over/Under 2.5") is a collapsible **Accordion**.
    *   **Main** tab usually keeps "Winner" and "Total Goals" expanded by default.
4.  **Sticky Header**: Keep the Score and Time sticky at the top while scrolling markets.

**Recommendation**: Implement a `/match/:id` page with ShadCN `Tabs` component.

### C. Data Merging Logic (Frontend)
1.  **Fetch Fixtures**: You get an array of matches.
2.  **Fetch Odds**: You get an array of odds objects.
3.  **Merge**:
    ```javascript
    matches.map(match => {
       const matchOdds = oddsResponse.find(o => o.fixture.id === match.fixture.id);
       return { ...match, odds: matchOdds };
    })
    ```
### D. The "Waterfall" (How to Fetch)
You cannot fetch odds until you know *which match* you want.
1.  **Step 1**: Fetch the list of matches (Step 2 above).
    *   *Result*: `[{ fixture: { id: 101 }, ... }, { fixture: { id: 102 }, ... }]`
2.  **Step 2**: LOOP through that list and fetch odds for each ID.
    *   *Implementation*:
        ```javascript
        // Parallel Fetch for Speed
        const oddsPromises = fixtures.map(f =>
            fetch(`/odds?fixture=${f.fixture.id}`)
        );
        const allOdds = await Promise.all(oddsPromises);
        ```
    *   *Result*: Now you have the odds to match the game.

### E. The "All Leagues" View (Horizontal Grouping)
If you want to show matches grouped by league (like a table per league):
1.  **Fetch**: Get fixtures for "Top Leagues" or "Live All".
    *   `GET /fixtures?live=all` OR `GET /fixtures?next=50` (filtered heavily).
2.  **Group (Frontend)**:
    ```javascript
    const grouped = fixtures.reduce((acc, match) => {
      const leagueName = match.league.name;
      if (!acc[leagueName]) acc[leagueName] = [];
      acc[leagueName].push(match);
      return acc;
    }, {});
    ```
3.  **Render**: Iterate through the keys of `grouped` and render a `<LeagueHeader />` followed by a list of `<MatchRow />`.

### F. Data Sorting (Verified)
The API documentation does not explicitly promise sorting, BUT our **verification (Step 3)** proves it:
*   **Request**: `?next=1`
*   **Returned**: The fixture starting in 15 minutes (Leeds vs Nottm Forest).
*   **Conclusion**: `next=X` implicitly sorts by **Date Ascending** to give you the soonest games.
*   **Safety**: If you are paranoid, add `.sort((a,b) => a.fixture.timestamp - b.fixture.timestamp)` in your frontend. It's cheap and safe.

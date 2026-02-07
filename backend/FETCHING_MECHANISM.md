# Fixture Fetching Mechanisms

**Core Constraint:** You MUST fetch fixtures first (for team names, logos, IDs) → then fetch odds per fixture ID.

**Static Value:** League ID (e.g., Premier League = `39`) is constant and never changes.

---

## All Available Strategies

### 1. `next=N` — Next N Upcoming Games
```
/fixtures?league=39&next=50
```
| Pros | Cons |
|------|------|
| ✅ No season/date needed | ❌ Fixed limit (max 99) |
| ✅ Auto-rotates as games finish | ❌ May include past games if status not filtered |
| ✅ Simple, one call | |

**Best for:** Quick "upcoming games" list

---

### 2. `date=YYYY-MM-DD` — Games on Specific Date
```
/fixtures?date=2026-02-07
# Or with league filter:
/fixtures?league=39&date=2026-02-07
```
| Pros | Cons |
|------|------|
| ✅ No season needed | ❌ Need to dynamically generate today's date |
| ✅ Shows only today's games | ❌ Empty on days with no games |
| ✅ Cross-league (without `league`) | |

**Best for:** "Today's Games" tab

---

### 3. `from` + `to` — Date Range
```
/fixtures?league=39&season=2025&from=2026-02-07&to=2026-02-14
```
| Pros | Cons |
|------|------|
| ✅ Control exact window (e.g., next 7 days) | ❌ Requires season param |
| ✅ Shows all games in range | ❌ Need dynamic date calculation |

**Best for:** "This Week" view

---

### 4. `round=X` — Specific Gameweek
```
# Step 1: Get current round
/fixtures/rounds?league=39&season=2025&current=true
→ "Regular Season - 25"

# Step 2: Fetch that round
/fixtures?league=39&season=2025&round=Regular%20Season%20-%2025
```
| Pros | Cons |
|------|------|
| ✅ Exact gameweek (10 games for PL) | ❌ Requires 2 API calls |
| ✅ `current=true` auto-updates | ❌ Requires season param |
| ✅ Clean, predictable count | |

**Best for:** "Matchday 25" style displays

---

### 5. `status=NS` — Not Started Only
```
/fixtures?league=39&next=50&status=NS
# Or:
/fixtures?league=39&season=2025&status=NS
```
| Pros | Cons |
|------|------|
| ✅ Filters out finished games | ❌ None |
| ✅ Combine with any strategy | |

**Best for:** Always add this for betting UI

---

### 6. `live=all` — Currently Playing
```
/fixtures?live=all
# Or filter by leagues:
/fixtures?live=39-61-140
```
| Pros | Cons |
|------|------|
| ✅ No season/date/anything needed | ❌ Empty when no games are live |
| ✅ Real-time (15s updates) | |
| ✅ Fully dynamic | |

**Best for:** "Live Betting" tab

---

### 7. `season=YYYY` — Full Season
```
/fixtures?league=39&season=2025
# With status filter:
/fixtures?league=39&season=2025&status=NS
```
| Pros | Cons |
|------|------|
| ✅ Returns ALL remaining fixtures (139+) | ❌ Need to know current season |
| ✅ Comprehensive | ❌ Large payload |

**Best for:** Season calendar, fixture list

---

## Recommended Combinations for Betting App

| UI Section | API Call | Games Returned |
|------------|----------|----------------|
| **Live** | `/fixtures?live=all` | Only in-play |
| **Today** | `/fixtures?date={today}` | Today's games |
| **Upcoming (Quick)** | `/fixtures?league=39&next=20&status=NS` | Next 20 |
| **This Gameweek** | `/fixtures?league=39&season=2025&round={current}` | ~10 (1 matchday) |
| **All Upcoming** | `/fixtures?league=39&season=2025&status=NS` | 139 (rest of season) |

---

## Dynamic Season Detection (Optional)

If you want to avoid hardcoding `season=2025`:
```
/leagues?id=39&current=true
→ Extract: response[0].seasons.find(s => s.current).year
→ Returns: 2025
```

Then use that value in subsequent calls.

---

## Summary

**Simplest "Just Works" approach:**
```
/fixtures?league=39&next=50&status=NS
```
- No season needed
- No date calculation needed
- Returns next 50 upcoming games
- Automatically rotates as games complete

**Most Accurate for Betting (shows only games with odds likely):**
```
/fixtures?league=39&next=20&status=NS
```
- Odds are available ~1-14 days before a game
- `next=20` keeps you in that window
- Higher chance all fixtures have odds

---

## Fetching Bettable Fixtures: 3 Approaches

**The Problem:** API-Sports separates fixtures (team names, logos) and odds into different endpoints. You need both for a betting UI, but there's no single endpoint that returns "fixtures with odds".

---

### Option A: Fixtures-First (Client-Side Filter)

**Flow:**
```
1. Fetch: /fixtures?league=39&next=30&status=NS
2. For each fixture: Fetch /odds?fixture={id}&bookmaker=8
3. Filter: Remove fixtures where Bet365 has no odds
4. Display remaining bettable fixtures
```

> **Note:** `bookmaker=8` = Bet365. Only Bet365 odds are fetched.

| Pros | Cons |
|------|------|
| ✅ Simple to implement | ❌ N+1 API calls (30 fixtures = 31 calls) |
| ✅ Works with existing code | ❌ Some fixtures fetched then discarded |
| ✅ No database needed | ❌ Count unknown until all odds fetched |
| ✅ No season param required | ❌ Slower initial load |
| ✅ Bet365 only | |

**Best for:** MVPs, prototypes, small scale

**Code Example:**
```typescript
const fixtures = await fetchFixtures({ league: 39, next: 30, status: 'NS' });
const withOdds = await Promise.all(fixtures.map(async (f) => {
  const odds = await fetchOdds({ fixture: f.fixture.id, bookmaker: 8 }); // Bet365 only
  return { ...f, odds };
}));
// Filter out fixtures without Bet365 odds
const bettable = withOdds.filter(f => f.odds && f.odds.home !== "1.00");
```

---

### Option B: Odds-First (Fetch Only Bettable)

**Flow:**
```
1. Fetch: /odds?league=39&season=2025&bookmaker=8
   → Returns fixture IDs that have Bet365 odds
2. Extract fixture IDs from response
3. Fetch: /fixtures?ids={id1}-{id2}-{id3}... (max 20 per call)
4. Display all fixtures (100% have Bet365 odds)
```

> **Note:** `bookmaker=8` = Bet365. This ensures consistent odds from a single source.
> Only fixtures with Bet365 coverage will be returned.

| Pros | Cons |
|------|------|
| ✅ Only 2-3 API calls total | ❌ Requires season param (or dynamic detection) |
| ✅ 100% of fixtures have Bet365 odds | ❌ Fewer fixtures (only Bet365 coverage) |
| ✅ Exact count known upfront | ❌ Paginated at 10 results, may need multiple pages |
| ✅ Consistent odds source | ❌ Slightly more complex logic |
| ✅ Premium quality odds | |

**Best for:** Production apps wanting efficiency + consistent Bet365 odds

**Code Example:**
```typescript
// Bet365 only (bookmaker=8)
const oddsData = await fetchOdds({ league: 39, season: 2025, bookmaker: 8 });
const fixtureIds = oddsData.map(o => o.fixture.id).join('-');
const fixtures = await fetchFixtures({ ids: fixtureIds });
// All fixtures guaranteed to have Bet365 odds
```

---

### Option C: Backend Pre-Processing (Database Sync)

**Flow:**
```
Backend (every 10-30 minutes):
  1. Fetch /fixtures?league=39&next=30
  2. Fetch /odds for each fixture
  3. Merge and store in database (PostgreSQL/MongoDB)
  4. Store: { fixture, teams, odds, hasOdds: true/false }

Frontend:
  1. Query YOUR backend: GET /api/fixtures?league=39&bettable=true
  2. Instant response with exact count
```

| Pros | Cons |
|------|------|
| ✅ Instant frontend response | ❌ Requires database setup |
| ✅ Exact count always available | ❌ Data may be 10-30 min stale |
| ✅ No external API calls on user request | ❌ Need cron/worker for sync |
| ✅ How real betting apps work | ❌ More infrastructure |
| ✅ Protects API quota | ❌ More complex architecture |

**Best for:** Production sportsbooks, high traffic, professional apps

**Architecture:**
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API-Sports    │────▶│  Your Backend   │────▶│    Database     │
│   (External)    │     │   (Cron Sync)   │     │  (PostgreSQL)   │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌─────────────────┐              │
                        │    Frontend     │◀─────────────┘
                        │   (Instant!)    │
                        └─────────────────┘
```

---

## Summary: Which to Choose?

| Criteria | Option A | Option B | Option C |
|----------|----------|----------|----------|
| **Complexity** | Low | Medium | High |
| **API Calls per Request** | N+1 | 2-3 | 0 (from DB) |
| **Data Freshness** | Real-time | Real-time | 10-30 min |
| **Count Accuracy** | After fetch | Upfront | Instant |
| **Infrastructure** | None | None | Database + Cron |
| **Best Stage** | MVP | Beta | Production |

## Recommendation

| Your Stage | Use This |
|------------|----------|
| **Building MVP** | **Option A** — get it working, iterate fast |
| **Optimizing Performance** | **Option B** — reduce API calls |
| **Scaling to Production** | **Option C** — what real sportsbooks use |

---

## ✅ PREFERRED APPROACH: Option B with Pagination (DEFINITIVE)

**This is the production-ready, efficient approach we use:**

### Why Option B?

1. **Efficient**: Only 4-5 API calls total (vs 31+ for Option A)
2. **100% Bettable**: Every fixture returned has odds
3. **Dynamic**: Automatically detects current season
4. **Clean**: Filters out past odds automatically

### Implementation Flow

```
Step 1: /leagues?id={leagueId}&current=true
        → Get current season dynamically

Step 2: /odds?league={leagueId}&season={season}&bookmaker=8&page=1
        /odds?league={leagueId}&season={season}&bookmaker=8&page=2
        /odds?league={leagueId}&season={season}&bookmaker=8&page=3
        → Fetch ALL pages of Bet365 odds (pagination required!)

Step 3: Filter odds where fixture.date >= now
        → Remove historical/past odds

Step 4: /fixtures?ids={id1}-{id2}-{id3}...
        → Bulk fetch fixture details (max 20 IDs per call)

Step 5: Merge fixtures + odds, sort by date
        → Return complete bettable fixtures
```

### Critical: Pagination is REQUIRED

The `/odds` endpoint is **paginated at 10 results per page**:

```json
{
  "paging": {
    "current": 1,
    "total": 3  // ← Must fetch pages 1, 2, 3
  }
}
```

**Page 1**: May contain past/historical odds  
**Pages 2-3**: Contain current/future odds  

If you only fetch page 1, you get old data!

### Code Implementation (TypeScript)

```typescript
// 1. Get current season
const { data: leagueData } = await api.get("/football/leagues", {
    params: { id: leagueId, current: true }
});
const currentSeason = leagueData.response?.[0]?.seasons
    ?.find(s => s.current)?.year;

// 2. Fetch ALL pages of odds (Bet365 = bookmaker 8)
const allOdds = [];
let page = 1;
let totalPages = 1;

do {
    const { data } = await api.get("/football/odds", {
        params: { league: leagueId, season: currentSeason, bookmaker: 8, page }
    });
    allOdds.push(...data.response);
    totalPages = data.paging?.total || 1;
    page++;
} while (page <= totalPages);

// 3. Filter for future fixtures only
const now = new Date();
const futureOdds = allOdds.filter(o => new Date(o.fixture.date) >= now);

// 4. Extract fixture IDs and fetch in bulk
const fixtureIds = futureOdds.map(o => o.fixture.id);
const CHUNK_SIZE = 20;
const allFixtures = [];

for (let i = 0; i < fixtureIds.length; i += CHUNK_SIZE) {
    const chunk = fixtureIds.slice(i, i + CHUNK_SIZE);
    const { data } = await api.get("/football/fixtures", {
        params: { ids: chunk.join("-") }
    });
    allFixtures.push(...data.response);
}

// 5. Merge and sort
const result = allFixtures
    .filter(f => f.fixture.status.short === "NS")
    .map(f => ({
        ...f,
        odds: oddsMap.get(f.fixture.id)
    }))
    .sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));
```

---

## Bookmaker Coverage Analysis

All bookmakers return **identical fixture coverage** — the API stores odds per fixture, not per bookmaker:

| Bookmaker | ID | Premier League | Serie A | La Liga | Bundesliga | Ligue 1 | Eredivisie | Championship |
|-----------|-----|----------------|---------|---------|------------|---------|------------|--------------|
| 10Bet | 1 | 19 | 18 | 17 | 17 | 17 | 19 | 20 |
| Marathonbet | 2 | 19 | 18 | 17 | 17 | 17 | 19 | 20 |
| Betfair | 3 | 19 | 18 | 17 | 17 | 17 | 19 | 20 |
| Pinnacle | 4 | 19 | 18 | 17 | 17 | 17 | 19 | 20 |
| Bwin | 6 | 19 | 18 | 17 | 17 | 17 | 19 | 20 |
| William Hill | 7 | 19 | 18 | 17 | 17 | 17 | 19 | 20 |
| **Bet365** | **8** | **19** | **18** | **17** | **17** | **17** | **19** | **20** |
| 1xBet | 11 | 19 | 18 | 17 | 17 | 17 | 19 | 20 |

**Key Findings:**
- Bookmaker selection only affects **odds VALUES**, not which fixtures are available
- Use **Bet365 (ID: 8)** for brand recognition and consistent quality

---

## League IDs Reference

| League | ID | Country |
|--------|-----|---------|
| Premier League | 39 | England |
| Championship | 40 | England |
| Serie A | 135 | Italy |
| La Liga | 140 | Spain |
| Bundesliga | 78 | Germany |
| Ligue 1 | 61 | France |
| Eredivisie | 88 | Netherlands |

---

## What You Get with Option B

| Metric | Value |
|--------|-------|
| API Calls | 4-5 total |
| Data Freshness | Real-time |
| Fixtures Returned | Only bettable |
| Odds Window | ~5 days ahead |
| Historical Odds | Filtered out |


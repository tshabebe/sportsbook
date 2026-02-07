/**
 * Test Script: Compare fixtures fetch strategies and odds availability
 * 
 * Questions we're answering:
 * 1. Can we omit `next=50` and just use `status=NS`?
 * 2. How many fixtures actually have odds?
 * 3. Is there an API parameter to filter only fixtures with odds?
 */

import "dotenv/config";

const BASE_URL = "http://localhost:3001/api/football";
const LEAGUE_ID = 39; // Premier League

interface FetchResult {
    totalFixtures: number;
    fixturesWithOdds: number;
    fixturesWithoutOdds: number;
    fixtureIds: number[];
    oddsDetails: { id: number; hasOdds: boolean; bookmakers?: string[] }[];
}

async function fetchFromAPI(endpoint: string, params: Record<string, string>) {
    const url = new URL(`${BASE_URL}${endpoint}`);
    Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));

    const res = await fetch(url.toString());
    return res.json();
}

async function checkOddsForFixture(fixtureId: number): Promise<{ hasOdds: boolean; bookmakers: string[] }> {
    const data = await fetchFromAPI("/odds", { fixture: fixtureId.toString() });
    const response = data.response?.[0];

    if (response && response.bookmakers && response.bookmakers.length > 0) {
        const bookmakerNames = response.bookmakers.map((b: any) => b.name);
        const hasBet365 = bookmakerNames.includes("Bet365");
        const hasMatchWinner = response.bookmakers.some((b: any) =>
            b.bets?.some((bet: any) => bet.id === 1 || bet.name === "Match Winner")
        );

        return {
            hasOdds: hasMatchWinner,
            bookmakers: bookmakerNames
        };
    }

    return { hasOdds: false, bookmakers: [] };
}

async function testStrategy(name: string, params: Record<string, string>): Promise<FetchResult> {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Testing: ${name}`);
    console.log(`   Params: ${JSON.stringify(params)}`);
    console.log("=".repeat(60));

    // Fetch fixtures
    const fixturesData = await fetchFromAPI("/fixtures", params);
    const fixtures = fixturesData.response || [];
    const fixtureIds = fixtures.map((f: any) => f.fixture.id);

    console.log(`   Total fixtures returned: ${fixtures.length}`);

    if (fixtures.length === 0) {
        return {
            totalFixtures: 0,
            fixturesWithOdds: 0,
            fixturesWithoutOdds: 0,
            fixtureIds: [],
            oddsDetails: []
        };
    }

    // Check odds for first 10 fixtures (to avoid hitting API limits)
    const sampleSize = Math.min(10, fixtures.length);
    const sampleFixtures = fixtures.slice(0, sampleSize);

    console.log(`   Checking odds for first ${sampleSize} fixtures...`);

    const oddsDetails: FetchResult["oddsDetails"] = [];

    for (const fixture of sampleFixtures) {
        const id = fixture.fixture.id;
        const teams = `${fixture.teams.home.name} vs ${fixture.teams.away.name}`;
        const date = fixture.fixture.date;

        const { hasOdds, bookmakers } = await checkOddsForFixture(id);
        oddsDetails.push({ id, hasOdds, bookmakers });

        const status = hasOdds ? "✅" : "❌";
        const bookmakerStr = hasOdds ? ` [${bookmakers.slice(0, 3).join(", ")}...]` : "";
        console.log(`   ${status} ${id}: ${teams} (${date})${bookmakerStr}`);
    }

    const withOdds = oddsDetails.filter(o => o.hasOdds).length;
    const withoutOdds = oddsDetails.filter(o => !o.hasOdds).length;

    console.log(`\n   📈 Summary (sample of ${sampleSize}):`);
    console.log(`      With Odds: ${withOdds}/${sampleSize}`);
    console.log(`      Without Odds: ${withoutOdds}/${sampleSize}`);

    return {
        totalFixtures: fixtures.length,
        fixturesWithOdds: withOdds,
        fixturesWithoutOdds: withoutOdds,
        fixtureIds,
        oddsDetails
    };
}

async function testOddsMappingEndpoint() {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📊 Testing: /odds/mapping endpoint`);
    console.log("=".repeat(60));

    const data = await fetchFromAPI("/odds/mapping", {});
    const mappings = data.response || [];

    console.log(`   Total fixtures with odds in mapping: ${mappings.length}`);

    // Filter for Premier League
    const plMappings = mappings.filter((m: any) => m.league?.id === LEAGUE_ID);
    console.log(`   Premier League fixtures with odds: ${plMappings.length}`);

    if (plMappings.length > 0) {
        console.log(`   Sample fixture IDs: ${plMappings.slice(0, 5).map((m: any) => m.fixture.id).join(", ")}`);
    }

    return plMappings;
}

async function main() {
    console.log("🧪 Fixtures & Odds Availability Test");
    console.log("=====================================");
    console.log(`League: Premier League (ID: ${LEAGUE_ID})`);

    // Test 1: With next=50
    const withNext = await testStrategy("WITH next=50", {
        league: LEAGUE_ID.toString(),
        next: "50",
        status: "NS"
    });

    // Test 2: Without next (requires season)
    // Note: API requires season when using league without next
    const withoutNext = await testStrategy("WITHOUT next (season=2025)", {
        league: LEAGUE_ID.toString(),
        season: "2025",
        status: "NS"
    });

    // Test 3: Check /odds/mapping endpoint
    const oddsMapping = await testOddsMappingEndpoint();

    // Final comparison
    console.log(`\n${"=".repeat(60)}`);
    console.log("📋 FINAL COMPARISON");
    console.log("=".repeat(60));
    console.log(`\n   Strategy 1 (next=50): ${withNext.totalFixtures} fixtures`);
    console.log(`   Strategy 2 (season): ${withoutNext.totalFixtures} fixtures`);
    console.log(`   Odds Mapping (PL): ${oddsMapping.length} fixtures with odds available`);

    console.log(`\n   💡 RECOMMENDATION:`);
    if (oddsMapping.length > 0) {
        console.log(`      Use /odds/mapping to get fixture IDs that HAVE odds,`);
        console.log(`      then fetch those specific fixtures.`);
        console.log(`      This ensures 100% of displayed fixtures have valid odds.`);
    } else {
        console.log(`      Continue with current approach but filter out fixtures`);
        console.log(`      without odds on the client side.`);
    }
}

main().catch(console.error);

import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { FixtureResponse, OddResponse, ApiFootballResponse } from "../types/football";
import { compareIsoAsc, isPastIso } from "../lib/date";

type LeagueResponseItem = {
    seasons?: Array<{ current: boolean; year: number }>;
};


// --- Types for Custom Backend Responses ---

export interface Fixture extends Omit<FixtureResponse, 'odds'> {
    odds: {
        home: string;
        draw: string;
        away: string;
    };
}

// --- Hooks ---

// 1. Pre-Match (Home Page) - The "Direct" Way (Schedule)
export const useFixturesSchedule = (leagueId: number, status: string = "NS", next: number = 20) => {
    return useQuery({
        queryKey: ["fixtures", "schedule", leagueId, status],
        queryFn: async () => {
            const { data } = await api.get<ApiFootballResponse<FixtureResponse>>("/football/fixtures", {
                params: {
                    league: leagueId,
                    status: status,
                    next: next,
                }
            });
            return data.response;
        },
        enabled: !!leagueId,
    });
};

// 1. Pre-Match (Home Page) - Option B: Odds-First (Efficient)
// Fetches odds with pagination → extracts fixture IDs → bulk fetches fixtures
// This is more efficient than N+1 calls (2-4 calls vs 31+ calls)
// Helper: Fetch fixtures for a single league using Option B (Odds-First)
const fetchFixturesForLeague = async (leagueId: number) => {
    // 1. Get current season dynamically
    const { data: leagueData } = await api.get<ApiFootballResponse<LeagueResponseItem>>("/football/leagues", {
        params: { id: leagueId, current: true }
    });

    const currentSeason = leagueData.response?.[0]?.seasons?.find(
        (s: { current: boolean }) => s.current
    )?.year;

    if (!currentSeason) {
        console.warn("Could not determine current season for league", leagueId);
        return [];
    }

    // 2. Fetch ALL pages of odds (Bet365 only, bookmaker=8)
    const allOddsResponses: OddResponse[] = [];
    let currentPage = 1;
    let totalPages = 1;

    try {
        do {
            const { data: oddsData } = await api.get<ApiFootballResponse<OddResponse>>("/football/odds", {
                params: {
                    league: leagueId,
                    season: currentSeason,
                    bookmaker: 8,  // Bet365 only
                    page: currentPage
                }
            });

            if (oddsData.response) {
                allOddsResponses.push(...oddsData.response);
            }
            totalPages = oddsData.paging?.total || 1;
            currentPage++;
        } while (currentPage <= totalPages);
    } catch (e) {
        console.error(`Failed to fetch odds for league ${leagueId}`, e);
        return [];
    }

    if (allOddsResponses.length === 0) {
        return [];
    }

    // 3. Extract fixture IDs and odds data (filter for upcoming only)
    const fixtureOddsMap = new Map<number, { home: string; draw: string; away: string }>();
    const fixtureIds: number[] = [];

    for (const odds of allOddsResponses) {
        const fixtureId = odds.fixture?.id;
        const fixtureDate = odds.fixture?.date;

        // Skip past fixtures
        if (!fixtureId || !fixtureDate || isPastIso(fixtureDate)) continue;

        fixtureIds.push(fixtureId);

        // Extract 1x2 odds from Bet365
        let formattedOdds = { home: "1.00", draw: "1.00", away: "1.00" };
        const bookmaker = odds.bookmakers?.[0];

        if (bookmaker) {
            const matchWinner = bookmaker.bets?.find(
                (b: { id: number; name: string }) => b.id === 1 || b.name === "Match Winner"
            );

            if (matchWinner?.values) {
                formattedOdds = {
                    home: matchWinner.values.find((v: { value: string; odd: string }) => v.value === "Home")?.odd || "1.00",
                    draw: matchWinner.values.find((v: { value: string; odd: string }) => v.value === "Draw")?.odd || "1.00",
                    away: matchWinner.values.find((v: { value: string; odd: string }) => v.value === "Away")?.odd || "1.00",
                };
            }
        }

        fixtureOddsMap.set(fixtureId, formattedOdds);
    }

    if (fixtureIds.length === 0) {
        return [];
    }

    // 4. Fetch fixtures in bulk (max 20 per call)
    const allFixtures: FixtureResponse[] = [];
    const CHUNK_SIZE = 20;

    for (let i = 0; i < fixtureIds.length; i += CHUNK_SIZE) {
        const chunk = fixtureIds.slice(i, i + CHUNK_SIZE);
        const idsParam = chunk.join("-");

        const { data: fixturesData } = await api.get<ApiFootballResponse<FixtureResponse>>("/football/fixtures", {
            params: { ids: idsParam }
        });

        if (fixturesData.response) {
            allFixtures.push(...fixturesData.response);
        }
    }

    // 5. Merge fixtures with odds and filter for NS status
    return allFixtures
        .filter(f => f.fixture.status.short === "NS")
        .map(fixture => ({
            ...fixture,
            odds: fixtureOddsMap.get(fixture.fixture.id) || { home: "1.00", draw: "1.00", away: "1.00" }
        }));
};

// 1. Pre-Match (Home Page) - Option B: Odds-First (Efficient)
export const usePreMatchFixtures = (leagueId: number | null | 0) => {
    return useQuery({
        queryKey: ["fixtures", "prematch", "with-odds", leagueId],
        queryFn: async () => {
            // If specific league is selected
            if (leagueId && leagueId !== 0) {
                return await fetchFixturesForLeague(leagueId);
            }

            // If "All Leagues" (0 or null) -> Fetch multiple supported leagues in parallel
            // Supported: PL(39), Champ(40), Serie A(135), La Liga(140), Bundesliga(78), Ligue 1(61), Eredivisie(88)
            const TARGET_LEAGUES = [39, 40, 135, 140, 78, 61, 88];

            const results = await Promise.all(
                TARGET_LEAGUES.map(id => fetchFixturesForLeague(id))
            );

            // Flatten and sort by date
            const allFixtures = results.flat();
            allFixtures.sort((a, b) => compareIsoAsc(a.fixture.date, b.fixture.date));

            return allFixtures;
        },
        enabled: true, // Always enabled, handles 0 internally
        staleTime: 60 * 1000 // Cache for 1 min client-side
    });
};

// 2. Pre-Match (Match Details - "Every Bet Possible")
export const useFixtureDetails = (fixtureId: number) => {
    return useQuery({
        queryKey: ["fixture", "details", fixtureId],
        queryFn: async () => {
            // Parallel execution for rich context
            const [oddsRes, statsRes, , predictionsRes, eventsRes, fixtureRes] = await Promise.all([
                api.get<ApiFootballResponse<OddResponse>>("/football/odds", { params: { fixture: fixtureId } }),
                api.get<ApiFootballResponse<Record<string, unknown>>>("/football/fixtures/statistics", { params: { fixture: fixtureId } }),
                // For H2H we need team IDs, but usually we fetch fixture info first. 
                // To avoid waterfalls, we might split H2H. For now, let's just get the critical odds and stats.
                Promise.resolve({ data: { response: [] } }), // Placeholder
                api.get<ApiFootballResponse<Record<string, unknown>>>("/football/predictions", { params: { fixture: fixtureId } }),
                api.get<ApiFootballResponse<Record<string, unknown>>>("/football/fixtures/events", { params: { fixture: fixtureId } }), // updated path
                api.get<ApiFootballResponse<FixtureResponse>>("/football/fixtures", { params: { id: fixtureId } })
            ]);

            const odds = oddsRes.data.response?.[0];
            const stats = statsRes.data.response;
            const predictions = predictionsRes.data.response?.[0];
            const events = eventsRes.data.response;
            const fixtureData = fixtureRes.data.response?.[0];

            return {
                fixture: fixtureData,
                odds,
                stats,
                predictions,
                events
            };
        },
        enabled: !!fixtureId,
    });
};

// 3. Live Betting (In-Play)
export const useLiveFixtures = (leagueIds?: number[]) => {
    return useQuery({
        queryKey: ["fixtures", "live", leagueIds],
        queryFn: async () => {
            const params: Record<string, string> = { live: "all" };
            if (leagueIds && leagueIds.length > 0) {
                params.live = leagueIds.join("-");
            }

            const { data } = await api.get<ApiFootballResponse<FixtureResponse>>("/football/fixtures", {
                params
            });
            return data.response;
        },
        refetchInterval: 15000,
    });
};

export const useLiveOdds = (leagueId?: number) => {
    return useQuery({
        queryKey: ["odds", "live", leagueId],
        queryFn: async () => {
            const params: Record<string, number> = {};
            if (leagueId) params.league = leagueId;

            const { data } = await api.get<ApiFootballResponse<OddResponse>>("/football/odds/live", {
                params
            });
            return data.response;
        },
        refetchInterval: 5000,
    });
};

export const useLiveMatches = () => {
    // This hook combines live fixtures with live odds for a rich dashboard
    const { data: fixtures, isLoading: isFixturesLoading } = useLiveFixtures();
    const { data: odds, isLoading: isOddsLoading } = useLiveOdds();

    const mergedData = fixtures?.map((fixtureItem) => {
        const fixtureId = fixtureItem.fixture.id;
        const liveOddsItem = odds?.find((o) => o?.fixture?.id === fixtureId);

        // Extract 1x2 odds if available from the live odds response.
        let formattedOdds = { home: "1.00", draw: "1.00", away: "1.00" };

        if (liveOddsItem && liveOddsItem.bookmakers && liveOddsItem.bookmakers.length > 0) {
            const matchWinner = liveOddsItem.bookmakers[0].bets?.find((b: { id: number; name: string }) => b.id === 1 || b.name === "Match Winner");
            if (matchWinner) {
                formattedOdds = {
                    home: matchWinner.values.find((v: { value: string; odd: string }) => v.value === "Home")?.odd || "1.00",
                    draw: matchWinner.values.find((v: { value: string; odd: string }) => v.value === "Draw")?.odd || "1.00",
                    away: matchWinner.values.find((v: { value: string; odd: string }) => v.value === "Away")?.odd || "1.00",
                };
            }
        }

        return {
            ...fixtureItem,
            odds: formattedOdds
        };
    }) || [];

    return {
        data: mergedData,
        isLoading: isFixturesLoading || isOddsLoading
    };
};

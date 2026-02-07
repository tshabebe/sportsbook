import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { FixtureResponse, OddResponse, ApiFootballResponse } from "../types/football";


// --- Types for Custom Backend Responses ---

export interface Fixture extends Omit<FixtureResponse, 'odds'> {
    odds: {
        home: string;
        draw: string;
        away: string;
    };
}

interface League {
    id: number;
    name: string;
    country: string;
    logo: string | null;
    type: string | null;
}

interface PopularLeaguesResponse {
    ok: boolean;
    leagues: League[];
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

// 1. Pre-Match (Home Page) - The "Betting Site" Way (Filtered with Odds)
export const usePreMatchFixtures = (leagueId: number) => {
    return useQuery({
        queryKey: ["fixtures", "prematch", "with-odds", leagueId],
        queryFn: async () => {
            // 1. Fetch Fixtures
            const { data: fixturesData } = await api.get<ApiFootballResponse<FixtureResponse>>("/football/fixtures", {
                params: {
                    league: leagueId,
                    next: 50,
                    status: 'NS'
                }
            });

            const fixtures = fixturesData.response || [];

            // 2. Fetch Odds for each fixture (Parallel)
            // Note: In a real high-scale app, we might want to batch this or use a more efficient endpoint if available.
            // But for now, parallel requests against our cached proxy is fast.
            const fixturesWithOdds = await Promise.all(fixtures.map(async (fixture) => {
                try {
                    const { data: oddsData } = await api.get<ApiFootballResponse<OddResponse>>("/football/odds", {
                        params: { fixture: fixture.fixture.id }
                    });

                    const oddsResponse = oddsData.response?.[0];
                    let formattedOdds = { home: "1.00", draw: "1.00", away: "1.00" };

                    if (oddsResponse && oddsResponse.bookmakers && oddsResponse.bookmakers.length > 0) {
                        const bookmaker = oddsResponse.bookmakers[0]; // Take first bookmaker
                        const matchWinner = bookmaker.bets?.find((b) => b.id === 1 || b.name === "Match Winner");

                        if (matchWinner && matchWinner.values) {
                            formattedOdds = {
                                home: matchWinner.values.find((v) => v.value === "Home")?.odd || "1.00",
                                draw: matchWinner.values.find((v) => v.value === "Draw")?.odd || "1.00",
                                away: matchWinner.values.find((v) => v.value === "Away")?.odd || "1.00",
                            };
                        }
                    }

                    return {
                        ...fixture,
                        odds: formattedOdds
                    };
                } catch (e) {
                    // Fallback if odds fetch fails
                    console.error("Failed to fetch odds for fixture", fixture.fixture.id, e);
                    return {
                        ...fixture,
                        odds: { home: "1.00", draw: "1.00", away: "1.00" }
                    };
                }
            }));

            return fixturesWithOdds;
        },
        enabled: !!leagueId,
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
                api.get<ApiFootballResponse<any>>("/football/fixtures/statistics", { params: { fixture: fixtureId } }),
                // For H2H we need team IDs, but usually we fetch fixture info first. 
                // To avoid waterfalls, we might split H2H. For now, let's just get the critical odds and stats.
                Promise.resolve({ data: { response: [] } }), // Placeholder
                api.get<ApiFootballResponse<any>>("/football/predictions", { params: { fixture: fixtureId } }),
                api.get<ApiFootballResponse<any>>("/football/fixtures/events", { params: { fixture: fixtureId } }), // updated path
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
            const params: any = { live: "all" };
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
            const params: any = {};
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

        // Extract 1x2 odds if available from the live odds response
        // Default structure to prevent UI crashes in MatchCard comp
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

// 4. Top Leagues (Navigation)
export const useTopLeagues = () => {
    return useQuery({
        queryKey: ["leagues", "popular"],
        queryFn: async () => {
            const { data } = await api.get<PopularLeaguesResponse>("/football/leagues/popular");
            if (data.ok) {
                return data.leagues;
            }
            throw new Error("Failed to fetch popular leagues");
        },
        staleTime: 60 * 60 * 1000,
    });
};


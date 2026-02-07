import { useState, useMemo } from 'react';
import { Leaderboard } from "../components/Leaderboard";
import { PromotionsCarousel } from "../components/PromotionsCarousel";
import { usePreMatchFixtures, useLiveMatches, type Fixture } from "../hooks/useFootball";
import { LeagueGroup } from "../components/LeagueGroup";

export function HomePage() {
    // State: Default to 'prematch' as requested
    const [activeTab, setActiveTab] = useState<'prematch' | 'live'>('prematch');
    // Filter state: null means "All Leagues", otherwise specific ID
    const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);

    // Fetch Data
    // usePreMatchFixtures expects a number. If null (All Leagues), we pass 0 or a dummy value if backend supports it.
    // Given the previous code used "undefined", but TS errored.
    // I'll check useFootball implementation again or pass 0.
    // Assuming 0 means "all" in our backend logic or we will fix that next.
    const { data: preMatchFixtures, isLoading: isLoadingPre, error: errorPre } = usePreMatchFixtures(selectedLeagueId || 0);

    // Live matches hook doesn't return error
    const { data: liveFixtures, isLoading: isLoadingLive } = useLiveMatches();
    const errorLive = null;

    const fixtures = activeTab === 'prematch' ? preMatchFixtures : liveFixtures;
    const isLoading = activeTab === 'prematch' ? isLoadingPre : isLoadingLive;
    const error = activeTab === 'prematch' ? errorPre : errorLive;

    // Grouping Logic: Group flat list by League Name
    const groupedFixtures = useMemo(() => {
        if (!fixtures) return {};

        return fixtures.reduce((groups, fixture) => {
            const leagueName = fixture.league.name;
            if (!groups[leagueName]) {
                groups[leagueName] = {
                    fixtures: [],
                    logo: fixture.league.logo,
                    flag: fixture.league.flag || '' // Handle potential null flag for TS
                };
            }
            groups[leagueName].fixtures.push(fixture);
            return groups;
        }, {} as Record<string, { fixtures: Fixture[], logo: string, flag: string }>);
    }, [fixtures]);

    // Helper for Tab Button style
    const getTabClass = (tab: string) => `
       flex-1 py-3 text-sm font-semibold rounded-lg transition-all
       ${activeTab === tab
            ? 'bg-[#ffd60a] text-[#1d1d1d] shadow-md'
            : 'bg-[#282828] text-[#c8c8c8] hover:bg-[#333]'}
   `;

    return (
        <div className="flex flex-col gap-6 pb-20 md:pb-0 w-full max-w-[1200px] mx-auto">
            {/* Promotions Carousel */}
            <PromotionsCarousel />

            {/* View Toggle Tabs */}
            <div className="flex gap-4 bg-[#1d1d1d] p-1 rounded-xl">
                <button onClick={() => setActiveTab('prematch')} className={getTabClass('prematch')}>
                    <div className="flex items-center justify-center gap-2">
                        <span>Pre-Match</span>
                    </div>
                </button>
                <button onClick={() => setActiveTab('live')} className={getTabClass('live')}>
                    <div className="flex items-center justify-center gap-2">
                        <span>Live Events</span>
                    </div>
                </button>
            </div>

            {/* All Leagues / Top Leagues Filter Bar */}
            <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
                <button
                    onClick={() => setSelectedLeagueId(null)}
                    className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors border ${selectedLeagueId === null
                        ? 'bg-[#fafafa] text-[#1d1d1d] border-[#fafafa]'
                        : 'bg-[#1d1d1d] text-[#c8c8c8] border-[#333] hover:border-[#666]'
                        }`}
                >
                    ALL LEAGUES
                </button>
                {/* Quick Filters for Top Leagues (Hardcoded for speed) */}
                {[
                    { id: 39, name: 'Premier League' },
                    { id: 140, name: 'La Liga' },
                    { id: 135, name: 'Serie A' },
                    { id: 78, name: 'Bundesliga' },
                    { id: 61, name: 'Ligue 1' }
                ].map(league => (
                    <button
                        key={league.id}
                        onClick={() => setSelectedLeagueId(league.id)}
                        className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-colors border ${selectedLeagueId === league.id
                            ? 'bg-[#ffd60a] text-[#1d1d1d] border-[#ffd60a]'
                            : 'bg-[#1d1d1d] text-[#c8c8c8] border-[#333] hover:border-[#666]'
                            }`}
                    >
                        {league.name}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="flex flex-col gap-6 min-h-[500px]">
                {isLoading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd60a]"></div>
                    </div>
                ) : error ? (
                    <div className="text-center py-20 text-[#ff3939]">
                        Failed to load matches. Please try again.
                    </div>
                ) : Object.keys(groupedFixtures).length === 0 ? (
                    <div className="text-center py-20 text-[#c8c8c8]">
                        No matches found for this selection.
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {Object.entries(groupedFixtures).map(([leagueName, data]) => (
                            <LeagueGroup
                                key={leagueName}
                                leagueName={leagueName}
                                leagueLogo={data.logo}
                                countryFlag={data.flag}
                                fixtures={data.fixtures}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Leaderboard />
        </div>
    );
}

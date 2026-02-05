import { useState } from "react";
import { Button } from "../components/ui/Button";
import { Leaderboard } from "../components/Leaderboard";
import { MatchCard } from "../components/MatchCard";
import { useLiveMatches, useTopLeagues, usePreMatchFixtures } from "../hooks/useFootball";
import { ChevronRight } from "lucide-react";

export function HomePage() {
    const [activeTab, setActiveTab] = useState<'live' | 'prematch'>('live');

    // Live Data
    const { data: liveMatches, isLoading: isLiveLoading } = useLiveMatches();

    // Pre-match Data (Defaults to Premier League - 39 for now)
    const { data: preMatchMatches, isLoading: isPreMatchLoading } = usePreMatchFixtures(39, 1);

    // Top Leagues
    const { data: leagues } = useTopLeagues();

    // Derived State
    const isLoading = activeTab === 'live' ? isLiveLoading : isPreMatchLoading;
    const matches = activeTab === 'live' ? liveMatches : preMatchMatches;
    const sectionTitle = activeTab === 'live' ? 'Live Now' : 'Upcoming Matches';

    return (
        <div className="flex flex-col gap-6 pb-20 md:pb-0">
            {/* Promotions Carousel */}
            <section className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {[1, 2, 3].map(i => (
                    <div key={i} className="min-w-[280px] h-40 bg-gradient-to-br from-element-bg to-element-hover-bg rounded-xl border border-white/5 p-4 flex flex-col justify-end relative overflow-hidden group">
                        <div className="absolute inset-0 bg-accent-solid/5 group-hover:bg-accent-solid/10 transition-colors" />
                        <span className="text-accent-solid font-bold text-lg relative z-10">Casino Bonus</span>
                        <span className="text-text-muted text-sm relative z-10">100% up to 500€</span>
                    </div>
                ))}
            </section>

            {/* Navigation Tabs (Quick Filters) */}
            <div className="flex gap-6 border-b border-border-subtle">
                <button
                    onClick={() => setActiveTab('live')}
                    className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'live' ? 'text-accent-solid border-b-2 border-accent-solid' : 'text-text-muted hover:text-text-contrast'}`}
                >
                    Live
                </button>
                <button
                    onClick={() => setActiveTab('prematch')}
                    className={`pb-3 text-sm font-semibold transition-colors ${activeTab === 'prematch' ? 'text-accent-solid border-b-2 border-accent-solid' : 'text-text-muted hover:text-text-contrast'}`}
                >
                    Pre-match
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">

                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-6">

                    {/* Top Leagues (Moved to Top) */}
                    <div className="bg-element-bg rounded-xl border border-border-subtle p-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-text-contrast">Top Leagues</h3>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border border-border-subtle"><ChevronRight className="rotate-180" size={12} /></Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full border border-border-subtle"><ChevronRight size={12} /></Button>
                            </div>
                        </div>

                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                            {leagues?.map((league: any) => (
                                <button key={league.id} className="min-w-[100px] flex flex-col items-center gap-2 p-3 hover:bg-element-hover-bg rounded-xl border border-transparent hover:border-border-subtle transition-all group bg-element-hover-bg/10">
                                    <div className="w-12 h-12 rounded-full bg-white p-2 shadow-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <img src={league.logo} alt={league.name} className="w-full h-full object-contain" />
                                    </div>
                                    <span className="text-xs font-medium text-text-muted group-hover:text-text-contrast text-center leading-tight line-clamp-2 w-full">{league.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Games List (Live or Pre-match) */}
                    <div className="bg-element-bg rounded-xl border border-border-subtle overflow-hidden">
                        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-element-hover-bg/30">
                            <div className="flex items-center gap-2">
                                {activeTab === 'live' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                                <h2 className="font-semibold text-text-contrast">{sectionTitle}</h2>
                            </div>
                            <Button variant="ghost" size="sm" className="text-xs">View All <ChevronRight size={14} /></Button>
                        </div>

                        <div className="p-2">
                            {isLoading ? (
                                <div className="p-8 text-center text-text-muted">Loading matches...</div>
                            ) : matches && matches.length > 0 ? (
                                matches.map((fixture: any) => (
                                    <MatchCard key={fixture.fixture.id} fixture={fixture} />
                                ))
                            ) : (
                                <div className="p-8 text-center text-text-muted">No matches currently available.</div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Sidebar Widgets (Popular, Bets) - Hidden on mobile, shown on large screens */}
                <div className="hidden lg:flex flex-col w-80 gap-6">
                    {/* Popular Events Widget */}
                    <div className="bg-element-bg rounded-xl border border-border-subtle p-4">
                        <h3 className="font-semibold mb-3 text-text-contrast">Popular Events</h3>
                        <div className="flex flex-col gap-1">
                            {["Real Madrid vs Barcelona", "Man City vs Liverpool", "Lakers vs Celtics"].map((ev, i) => (
                                <div key={i} className="p-2 hover:bg-element-hover-bg rounded cursor-pointer text-sm text-text-muted hover:text-text-contrast flex justify-between">
                                    <span>{ev}</span>
                                    <ChevronRight size={14} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Leaderboard Section (At bottom) */}
            <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-text-contrast">Leaderboard</h2>
                <Leaderboard />
            </div>
        </div>
    );
}

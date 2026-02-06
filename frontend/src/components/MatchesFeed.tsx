import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "./ui/Button";
import { MatchCard } from "./MatchCard";
import { useLiveMatches, usePreMatchFixtures } from "../hooks/useFootball";

export function MatchesFeed() {
    const [activeTab, setActiveTab] = useState<'live' | 'prematch'>('live');

    // Live Data
    const { data: liveMatches, isLoading: isLiveLoading } = useLiveMatches();

    // Pre-match Data (Defaults to Premier League - 39 for now)
    const { data: preMatchMatches, isLoading: isPreMatchLoading } = usePreMatchFixtures(39);

    // Derived State
    const isLoading = activeTab === 'live' ? isLiveLoading : isPreMatchLoading;
    const matches = activeTab === 'live' ? liveMatches : preMatchMatches;
    const sectionTitle = activeTab === 'live' ? 'Live Now' : 'Upcoming Matches';

    return (
        <div className="flex flex-col gap-6">
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
    );
}

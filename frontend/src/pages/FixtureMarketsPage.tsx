import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronUp, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { api } from '../lib/api';
import { useBetSlip } from '../context/BetSlipContext';

// --- Types ---

interface MarketAccordionProps {
    title: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}

interface FixtureDetails {
    fixture: { id: number; date: string };
    league: { name: string; logo: string };
    teams: {
        home: { name: string; logo: string };
        away: { name: string; logo: string };
    };
}

interface OddsData {
    fixture: { id: number; date: string };
    league: { name: string };
    bookmakers: Array<{
        id: number;
        bets: Array<{
            id: number;
            name: string;
            values: Array<{ value: string; odd: string; handicap?: string }>;
        }>;
    }>;
}

// --- Components ---

function MarketAccordion({ title, isOpen, onToggle, children }: MarketAccordionProps) {
    return (
        <div className="bg-[#1d1d1d] rounded-lg overflow-hidden border border-[#333] mb-3">
            <button
                onClick={onToggle}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#282828] hover:bg-[#333] transition-colors"
            >
                <span className="text-[#fafafa] font-semibold text-sm">{title}</span>
                {isOpen ? <ChevronUp className="w-5 h-5 text-[#c8c8c8]" /> : <ChevronDown className="w-5 h-5 text-[#c8c8c8]" />}
            </button>
            <div className={`transition-all duration-300 ease-in-out ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                <div className="p-4 grid grid-cols-2 gap-3">
                    {children}
                </div>
            </div>
        </div>
    );
}

function OutcomeButton({ label, odd, isSelected, onClick }: { label: string, odd: string, isSelected: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center py-2.5 rounded-md transition-all border ${isSelected
                ? 'bg-[#ffd60a] border-[#ffd60a] text-[#1d1d1d]'
                : 'bg-[#282828] border-[#333] text-[#fafafa] hover:border-[#666]'
                }`}
        >
            <span className="text-xs text-opacity-80 mb-0.5">{label}</span>
            <span className="font-bold text-sm">{odd}</span>
        </button>
    );
}

export function FixtureMarketsPage() {
    const { fixtureId } = useParams<{ fixtureId: string }>();
    const navigate = useNavigate();
    const { addToBetSlip, bets } = useBetSlip();
    const [openMarkets, setOpenMarkets] = useState<Record<string, boolean>>({ 'Match Winner': true, 'Goals Over/Under': true });

    // Fetch fixture details (team names, logos)
    const { data: fixtureDetails, isLoading: isLoadingFixture } = useQuery({
        queryKey: ['fixture-details', fixtureId],
        queryFn: async () => {
            const { data } = await api.get('/football/fixtures', {
                params: { id: fixtureId }
            });
            return data.response?.[0] as FixtureDetails | undefined;
        },
        enabled: !!fixtureId
    });

    // Fetch odds for all markets
    const { data: oddsData, isLoading: isLoadingOdds } = useQuery({
        queryKey: ['fixture-odds', fixtureId],
        queryFn: async () => {
            const { data } = await api.get('/football/odds', {
                params: { fixture: fixtureId, bookmaker: 8 } // Bet365
            });
            return data.response?.[0] as OddsData | undefined;
        },
        enabled: !!fixtureId
    });

    const toggleMarket = (marketName: string) => {
        setOpenMarkets(prev => ({ ...prev, [marketName]: !prev[marketName] }));
    };

    const isLoading = isLoadingFixture || isLoadingOdds;

    if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ffd60a]"></div></div>;
    if (!fixtureDetails) return <div className="text-center py-20 text-[#c8c8c8]">Fixture not found.</div>;

    const fixture = fixtureDetails.fixture;
    const league = fixtureDetails.league;
    const teams = fixtureDetails.teams;
    const markets = oddsData?.bookmakers?.[0]?.bets || [];
    const bookmakerId = oddsData?.bookmakers?.[0]?.id;

    // Helper to check selection
    const isSelected = (selectionId: string) => bets.some(b => b.id === selectionId);

    // Generate fixture name for bet slip
    const fixtureName = `${teams.home.name} vs ${teams.away.name}`;

    return (
        <div className="w-full max-w-[800px] mx-auto pb-20">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-[#121212] border-b border-[#333] px-4 py-3 flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-[#282828] text-[#c8c8c8]">
                    <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="flex-1 text-center pr-10">
                    <div className="text-[10px] text-[#888] uppercase tracking-wider mb-0.5">
                        {league.name} • {new Date(fixture.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </div>

            {/* Teams Scoreboard */}
            <div className="bg-[#1d1d1d] p-6 mb-6">
                <div className="flex justify-between items-center max-w-[400px] mx-auto">
                    <div className="text-center w-1/3 flex flex-col items-center gap-2">
                        <img
                            src={teams.home.logo}
                            alt={teams.home.name}
                            className="w-12 h-12 object-contain"
                        />
                        <div className="font-bold text-white text-sm">{teams.home.name}</div>
                    </div>
                    <div className="text-[#ffd60a] font-mono text-2xl font-bold">VS</div>
                    <div className="text-center w-1/3 flex flex-col items-center gap-2">
                        <img
                            src={teams.away.logo}
                            alt={teams.away.name}
                            className="w-12 h-12 object-contain"
                        />
                        <div className="font-bold text-white text-sm">{teams.away.name}</div>
                    </div>
                </div>
            </div>

            {/* Markets List */}
            <div className="px-4">
                {markets.length === 0 ? (
                    <div className="text-center py-10 text-[#888]">
                        No markets available for this fixture.
                    </div>
                ) : (
                    markets.map((market) => (
                        <MarketAccordion
                            key={market.id}
                            title={market.name}
                            isOpen={openMarkets[market.name] ?? false}
                            onToggle={() => toggleMarket(market.name)}
                        >
                            {market.values.map((outcome) => {
                                const selectionId = `${fixture.id}-${market.id}-${outcome.value}`;
                                return (
                                    <OutcomeButton
                                        key={outcome.value}
                                        label={outcome.value}
                                        odd={outcome.odd}
                                        isSelected={isSelected(selectionId)}
                                        onClick={() => {
                                            addToBetSlip({
                                                id: selectionId,
                                                fixtureId: fixture.id,
                                                betId: market.id,
                                                value: outcome.value,
                                                odd: Number(outcome.odd),
                                                handicap: outcome.handicap,
                                                bookmakerId: bookmakerId,
                                                fixtureName: fixtureName,
                                                marketName: market.name,
                                                selectionName: outcome.value,
                                                odds: Number(outcome.odd)
                                            });
                                        }}
                                    />
                                );
                            })}
                        </MarketAccordion>
                    ))
                )}
            </div>
        </div>
    );
}

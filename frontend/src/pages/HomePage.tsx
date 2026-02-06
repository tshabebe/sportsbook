import { Leaderboard } from "../components/Leaderboard";
import { PromotionsCarousel } from "../components/PromotionsCarousel";
import { TopLeagues } from "../components/TopLeagues";
import { MatchesFeed } from "../components/MatchesFeed";

export function HomePage() {
    return (
        <div className="flex flex-col gap-6 pb-20 md:pb-0">
            {/* Promotions Carousel */}
            <PromotionsCarousel />

            <div className="flex flex-col lg:flex-row gap-6">

                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-6">

                    {/* Top Leagues (Moved to Top) */}
                    <TopLeagues />

                    {/* Games List (Live or Pre-match) */}
                    <MatchesFeed />
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


import { Button } from "../components/ui/Button";
import { Leaderboard } from "../components/Leaderboard";

export function HomePage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-text-contrast">Home</h1>
                <Button variant="solid">Place Bet</Button>
            </div>

            <div className="flex flex-wrap gap-4">
                {/* Card Component Placeholder - using flex basis for column-like behavior */}
                <div className="flex flex-col p-4 rounded-lg bg-element-bg border border-border-subtle hover:bg-element-hover-bg transition-colors w-full md:w-[calc(50%-0.5rem)] lg:w-[calc(33.333%-0.67rem)]">
                    <div className="text-accent-solid font-bold mb-2">Live Game</div>
                    <div className="text-text-contrast">Team A vs Team B</div>
                    <div className="flex gap-2 mt-4">
                        <Button variant="outline" size="sm" className="flex-1">1.50</Button>
                        <Button variant="outline" size="sm" className="flex-1">3.20</Button>
                        <Button variant="outline" size="sm" className="flex-1">2.10</Button>
                    </div>
                </div>
                {/* More mock cards can go here */}
            </div>

            <div className="flex flex-col gap-4">
                <h2 className="text-xl font-bold text-text-contrast">Leaderboard</h2>
                <Leaderboard />
            </div>
        </div>
    );
}

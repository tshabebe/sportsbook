import { ChevronRight } from "lucide-react";
import { Button } from "./ui/Button";
import { useTopLeagues } from "../hooks/useFootball";

export function TopLeagues() {
    const { data: leagues } = useTopLeagues();

    return (
        <div className="bg-element-bg rounded-xl border border-border-subtle p-4">
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
    );
}

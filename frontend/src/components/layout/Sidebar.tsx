import { useState } from "react";
import { ChevronDown, ChevronRight, Search, Trophy, Dices, Star, Gamepad2, DollarSign, TrendingUp } from "lucide-react";

interface SidebarItem {
    id: string;
    label: string;
    icon: React.ReactNode;
    children?: SidebarItem[];
}

const sidebarItems: SidebarItem[] = [
    { id: "search", label: "Search", icon: <Search size={16} /> },
    { id: "all-sports", label: "All Sports", icon: <Trophy size={16} /> },
    {
        id: "sportsbook",
        label: "Sportsbook",
        icon: <Star size={16} />,
        children: [
            { id: "football", label: "Football", icon: <ChevronRight size={16} /> },
            { id: "basketball", label: "Basketball", icon: <ChevronRight size={16} /> },
            { id: "tennis", label: "Tennis", icon: <ChevronRight size={16} /> },
        ],
    },
    { id: "live-casino", label: "Live Casino", icon: <Gamepad2 size={16} /> },
    { id: "casino-games", label: "Casino Games", icon: <Dices size={16} /> },
    { id: "slots", label: "Slots", icon: <Dices size={16} /> },
    { id: "live-events", label: "Live Events", icon: <TrendingUp size={16} /> },
    { id: "bet-builder", label: "Bet Builder", icon: <Star size={16} /> },
    {
        id: "sports-games",
        label: "Sports Games",
        icon: <Trophy size={16} />,
        children: [
            { id: "live", label: "Live", icon: <ChevronRight size={16} /> },
            { id: "upcoming", label: "Upcoming", icon: <ChevronRight size={16} /> },
        ],
    },
    { id: "weekly-promo", label: "Weekly Promotions", icon: <DollarSign size={16} /> },
];

export function Sidebar() {
    const [expandedItems, setExpandedItems] = useState<string[]>(["sportsbook"]);

    const toggleItem = (id: string) => {
        setExpandedItems((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        );
    };

    const renderItem = (item: SidebarItem, depth: number = 0) => {
        const isExpanded = expandedItems.includes(item.id);
        const hasChildren = item.children && item.children.length > 0;
        const isActive = item.id === "sportsbook";

        return (
            <div key={item.id}>
                <button
                    onClick={() => hasChildren && toggleItem(item.id)}
                    className={`
            flex items-center justify-between w-full px-4 py-2.5 text-sm text-left transition-colors
            ${isActive
                            ? "bg-accent-solid text-accent-text-contrast font-semibold shadow-sm"
                            : "text-text-muted hover:bg-element-hover-bg hover:text-text-contrast"
                        }
          `}
                    style={{ paddingLeft: `${16 + depth * 12}px` }}
                >
                    <div className="flex items-center gap-3">
                        {item.icon}
                        <span>{item.label}</span>
                    </div>
                    {hasChildren && (
                        <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${isExpanded ? "" : "-rotate-90"}`}
                        />
                    )}
                </button>
                {hasChildren && isExpanded && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        {item.children!.map((child) => renderItem(child, depth + 1))}
                    </div>
                )}
            </div>
        );
    };

    return (
        <aside className="w-[240px] hidden md:flex flex-col bg-element-bg border-r border-border-subtle h-full overflow-y-auto">
            <div className="py-2">
                {sidebarItems.map((item) => renderItem(item))}
            </div>
        </aside>
    );
}

import { User, Trophy, Target, Ticket as TicketIcon } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useBetSlip } from "../../context/BetSlipContext";

export function BottomNav() {
    const location = useLocation();
    const pathname = location.pathname;
    const { bets, toggleBetSlip, isOpen } = useBetSlip();
    const betCount = bets.length;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-[#333] bg-[#141414] py-2 pb-safe md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.3)]">
            <NavItem
                to="/play"
                icon={<Trophy size={22} />}
                label="Sports"
                isActive={pathname === "/play" || pathname === "/play/"}
            />
            <NavItem
                to="/play/betslip"
                icon={<TicketIcon size={22} />}
                label="Ticket"
                isActive={isOpen}
                badgeCount={betCount}
                onClick={(e) => {
                    e.preventDefault();
                    toggleBetSlip();
                }}
            />
            <NavItem
                to="/play/track"
                icon={<Target size={22} />}
                label="Track"
                isActive={pathname.startsWith("/play/track")}
            />
            <NavItem
                to="/retail/login"
                icon={<User size={22} />}
                label="Retail"
                isActive={pathname.startsWith("/retail")}
            />
        </div>
    );
}

function NavItem({
    to,
    icon,
    label,
    isActive,
    badgeCount,
    onClick,
}: {
    to: string;
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    badgeCount?: number;
    onClick?: (e: React.MouseEvent) => void;
}) {
    return (
        <Link to={to} onClick={onClick} className="group relative flex flex-1 flex-col items-center justify-center pt-2">
            <div className={cn("relative transition-colors duration-200", isActive ? "text-[#ffd60a]" : "text-[#8a8a8a] group-hover:text-[#ffffff]")}>
                {icon}
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#ef4444] text-[10px] font-bold text-white">
                        {badgeCount}
                    </span>
                )}
            </div>
            <span className={cn("mt-1 text-[10px] font-medium transition-colors duration-200", isActive ? "text-[#ffd60a]" : "text-[#8a8a8a] group-hover:text-[#ffffff]")}>
                {label}
            </span>

            {/* Active Indicator Line */}
            {isActive && (
                <div className="absolute bottom-0 h-[3px] w-8 rounded-t-full bg-[#ffd60a] shadow-[0_0_8px_rgba(255,214,10,0.5)]" />
            )}
        </Link>
    );
}

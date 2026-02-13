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
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border-subtle bg-element-bg py-2 pb-safe shadow-sm md:hidden">
            <NavItem
                to="/play"
                testId="bottomnav-sports"
                icon={<Trophy size={22} />}
                label="Sports"
                isActive={pathname === "/play" || pathname === "/play/"}
            />
            <NavItem
                to="/play/betslip"
                testId="bottomnav-ticket"
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
                testId="bottomnav-track"
                icon={<Target size={22} />}
                label="Track"
                isActive={pathname.startsWith("/play/track")}
            />
            <NavItem
                to="/retail/login"
                testId="bottomnav-retail"
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
    testId,
    isActive,
    badgeCount,
    onClick,
}: {
    to: string;
    icon: React.ReactNode;
    label: string;
    testId?: string;
    isActive?: boolean;
    badgeCount?: number;
    onClick?: (e: React.MouseEvent) => void;
}) {
    return (
        <Link
            data-testid={testId}
            to={to}
            onClick={onClick}
            className="group relative flex flex-1 flex-col items-center justify-center gap-1 pt-2"
        >
            <div className={cn("relative transition-colors duration-200", isActive ? "text-accent-solid" : "text-text-muted group-hover:text-text-contrast")}>
                {icon}
                {badgeCount !== undefined && badgeCount > 0 && (
                    <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-status-negative text-[10px] font-bold text-accent-text-contrast">
                        {badgeCount}
                    </span>
                )}
            </div>
            <span className={cn("text-[10px] font-medium transition-colors duration-200", isActive ? "text-accent-solid" : "text-text-muted group-hover:text-text-contrast")}>
                {label}
            </span>

            {isActive && (
                <div className="absolute bottom-0 h-[3px] w-8 rounded-t-full bg-accent-solid shadow-sm" />
            )}
        </Link>
    );
}

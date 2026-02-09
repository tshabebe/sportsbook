import { User, Trophy, Target, Gamepad2 } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils";

export function BottomNav() {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-element-bg border-t border-border-subtle md:hidden">
            <NavItem to="/play" icon={<Trophy size={20} />} label="Sports" active />
            <NavItem to="/play/betslip" icon={<Gamepad2 size={20} />} label="Ticket" />
            <NavItem to="/play/track" icon={<Target size={20} />} label="Track" />
            <NavItem to="/retail/login" icon={<User size={20} />} label="Retail" />
        </div>
    );
}

function NavItem({
    to,
    icon,
    label,
    active,
}: {
    to: string;
    icon: React.ReactNode;
    label: string;
    active?: boolean;
}) {
    return (
        <Link to={to} className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className={cn("text-text-muted group-hover:text-text-contrast transition-colors", active && "text-text-contrast")}>
                {icon}
            </div>
            <span className={cn("text-[10px] font-medium text-text-muted group-hover:text-text-contrast transition-colors", active && "text-text-contrast")}>
                {label}
            </span>
            {active && <div className="h-0.5 w-8 bg-accent-solid mt-1 rounded-full" />}
        </Link>
    );
}

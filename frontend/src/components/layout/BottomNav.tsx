import { User, Trophy, Target, Gamepad2 } from "lucide-react";
import { cn } from "../../lib/utils";

export function BottomNav() {
    return (
        <div className="flex items-center justify-between px-4 py-3 bg-element-bg border-t border-border-subtle md:hidden">
            <NavItem icon={<Trophy size={20} />} label="Sports" active />
            <NavItem icon={<Gamepad2 size={20} />} label="Single" />
            <NavItem icon={<Target size={20} />} label="Multi" />
            <NavItem icon={<User size={20} />} label="Profile" />
        </div>
    );
}

function NavItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
    return (
        <div className="flex flex-col items-center gap-1 cursor-pointer group">
            <div className={cn("text-text-muted group-hover:text-text-contrast transition-colors", active && "text-text-contrast")}>
                {icon}
            </div>
            <span className={cn("text-[10px] font-medium text-text-muted group-hover:text-text-contrast transition-colors", active && "text-text-contrast")}>
                {label}
            </span>
            {active && <div className="h-0.5 w-8 bg-accent-solid mt-1 rounded-full" />}
        </div>
    );
}

import { Menu, Plus, User } from "lucide-react";
import { Button } from "../ui/Button";

export function Header() {
    return (
        <header className="flex items-center justify-between bg-element-bg h-16 px-4 border-b border-border-subtle">
            {/* Left: Menu and Logo */}
            <div className="flex items-center gap-4">
                <button className="text-text-contrast p-2 hover:bg-element-hover-bg rounded-lg transition-colors">
                    <Menu size={20} />
                </button>
                <div className="flex items-center gap-1">
                    <span className="text-text-contrast text-xl font-bold">classicBet</span>
                </div>
            </div>

            {/* Right: Balance and Buttons */}
            <div className="flex items-center gap-3">
                <span className="text-text-contrast text-sm font-medium">10,353.50€</span>
                <Button variant="solid" size="sm" className="w-8 h-8 !px-0 rounded-full">
                    <Plus size={18} />
                </Button>
                <Button variant="solid" size="sm" className="w-8 h-8 !px-0 rounded-full">
                    <User size={18} />
                </Button>
            </div>
        </header>
    );
}

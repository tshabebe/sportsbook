import { Menu, Wifi, Battery, Signal } from "lucide-react";
import { Button } from "../ui/Button";

export function MobileHeader() {
    return (
        <header className="flex flex-col bg-element-bg md:hidden border-b border-border-subtle">
            {/* Status Bar (Mock) */}
            <div className="flex justify-between items-center px-4 py-1 text-[10px] text-text-muted">
                <span>9:41</span>
                <div className="flex items-center gap-1">
                    <Signal size={10} />
                    <Wifi size={10} />
                    <Battery size={10} />
                </div>
            </div>

            {/* Main Bar */}
            <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                    <Menu size={20} className="text-text-contrast" />
                    <div className="flex items-center gap-1">
                        <span className="text-text-contrast text-xl font-bold">classicBet</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-element-hover-bg rounded-lg p-1 pl-2">
                    <span className="text-text-contrast text-xs font-medium">10,303.56 €</span>
                    <Button variant="solid" size="sm" className="w-6 h-6 !px-0 rounded-md">
                        <span className="text-lg leading-none">+</span>
                    </Button>
                </div>
            </div>
        </header>
    );
}

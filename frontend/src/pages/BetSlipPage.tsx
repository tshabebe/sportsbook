import { Betslip } from "../components/Betslip";
import { MobileHeader } from "../components/layout/MobileHeader";

export function BetSlipPage() {
    return (
        <div className="flex flex-col h-full bg-element-bg">
            <MobileHeader />
            <div className="flex-1 overflow-hidden">
                <Betslip isOpen={true} className="border-0 w-full" />
            </div>
        </div>
    );
}

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { Betslip } from "../Betslip";
import { useState, useEffect } from "react";
import { useBetSlip } from "../../context/BetSlipContext";
import { Outlet, useLocation } from "react-router-dom";

export function Layout() {
    // Desktop Layout States
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isBetslipOpen, setIsBetslipOpen] = useState(true);

    const { isOpen: isMobileBetslipOpen, toggleBetSlip, replaceBetSlip } = useBetSlip();
    const location = useLocation();

    // Sharing / Recreate Logic
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const shareCode = params.get('share');
        if (shareCode) {
            const loadSharedTicket = async () => {
                try {
                    const { data } = await import("../../lib/api").then(m => m.api.get(`/tickets/${shareCode}/recreate`));
                    if (data.ok && data.bets) {
                        replaceBetSlip(data.bets);
                        // Clean URL
                        window.history.replaceState({}, '', window.location.pathname);
                    }
                } catch (err) {
                    console.error("Failed to load shared ticket", err);
                }
            };
            void loadSharedTicket();
        }
    }, [location.search, replaceBetSlip]);

    // Close mobile betslip when navigating
    useEffect(() => {
        if (isMobileBetslipOpen) {
            toggleBetSlip();
        }
    }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="flex flex-col h-screen bg-app-bg text-text-contrast font-poppins">
            {/* Desktop Header */}
            <div className="hidden md:block">
                <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
            </div>

            {/* Mobile Header */}
            <MobileHeader />

            <div className="flex flex-1 overflow-hidden relative">
                {/* Sidebar: Desktop Only */}
                {isSidebarOpen && (
                    <div className="hidden md:flex">
                        <Sidebar />
                    </div>
                )}

                <main className="flex-1 overflow-y-auto p-4 pb-24 md:pb-4">
                    <div key={location.pathname} className="page-enter">
                        <Outlet />
                    </div>
                </main>

                {/* Desktop Betslip */}
                <div className="hidden md:flex">
                    <Betslip isOpen={isBetslipOpen} onClose={() => setIsBetslipOpen(false)} className="w-[320px]" />
                </div>

                {/* Mobile Betslip Drawer */}
                <div
                    className={`fixed inset-0 z-40 bg-black/80 transition-opacity md:hidden ${isMobileBetslipOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                        }`}
                    onClick={toggleBetSlip}
                />
                <div
                    className={`fixed inset-x-0 bottom-[60px] top-0 z-40 transform bg-[#141414] transition-transform duration-300 md:hidden ${isMobileBetslipOpen ? 'translate-y-0' : 'translate-y-full'
                        }`}
                >
                    <div className="h-full w-full overflow-hidden">
                        <Betslip isOpen={true} onClose={toggleBetSlip} className="h-full w-full border-none" />
                    </div>
                </div>
            </div>

            {/* Bottom Nav: Mobile Only */}
            <div className="z-50 relative md:hidden">
                <BottomNav />
            </div>
        </div>
    );
}

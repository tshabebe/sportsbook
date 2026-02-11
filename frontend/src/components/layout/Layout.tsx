import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { BottomNav } from "./BottomNav";
import { Betslip } from "../Betslip";
import { useState } from "react";

export function Layout() {
    // Desktop Betslip State
    const [isBetslipOpen, setIsBetslipOpen] = useState(true);
    const location = useLocation();

    return (
        <div className="flex flex-col h-screen bg-app-bg text-text-contrast font-poppins">
            <div className="flex flex-1 overflow-hidden">

                {/* Sidebar: Desktop Only */}
                <div className="hidden md:flex">
                    <Sidebar />
                </div>

                <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
                    <div key={location.pathname} className="page-enter">
                        <Outlet />
                    </div>
                </main>

                {/* Betslip: Desktop Only (Mobile uses /betslip route) */}
                <div className="hidden md:flex">
                    <Betslip isOpen={isBetslipOpen} onClose={() => setIsBetslipOpen(false)} className="w-[320px]" />
                </div>
            </div>

            {/* Bottom Nav: Mobile Only */}
            <BottomNav />
        </div>
    );
}

import { lazy, Suspense } from "react";
import { Navigate, Outlet, Routes, Route } from "react-router-dom";
import { getRetailToken } from "./lib/retailAuth";

const Layout = lazy(() => import("./components/layout/Layout").then((m) => ({ default: m.Layout })));
const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const BetSlipPage = lazy(() => import("./pages/BetSlipPage").then((m) => ({ default: m.BetSlipPage })));
const FixtureMarketsPage = lazy(() => import("./pages/FixtureMarketsPage").then((m) => ({ default: m.FixtureMarketsPage })));
const RetailLayout = lazy(() =>
  import("./components/layout/RetailLayout").then((m) => ({ default: m.RetailLayout })),
);
const RetailLoginPage = lazy(() =>
  import("./pages/retail/RetailLoginPage").then((m) => ({ default: m.RetailLoginPage })),
);
const RetailDashboardPage = lazy(() =>
  import("./pages/retail/RetailDashboardPage").then((m) => ({ default: m.RetailDashboardPage })),
);
const TicketTrackerPage = lazy(() =>
  import("./pages/play/TicketTrackerPage").then((m) => ({ default: m.TicketTrackerPage })),
);
const PlayVariant1Page = lazy(() =>
  import("./pages/play/PlayVariant1Page").then((m) => ({ default: m.PlayVariant1Page })),
);
const PlayVariant2Page = lazy(() =>
  import("./pages/play/PlayVariant2Page").then((m) => ({ default: m.PlayVariant2Page })),
);
const PlayVariant3Page = lazy(() =>
  import("./pages/play/PlayVariant3Page").then((m) => ({ default: m.PlayVariant3Page })),
);
const PlayVariant4Page = lazy(() =>
  import("./pages/play/PlayVariant4Page").then((m) => ({ default: m.PlayVariant4Page })),
);
const PlayVariant5Page = lazy(() =>
  import("./pages/play/PlayVariant5Page").then((m) => ({ default: m.PlayVariant5Page })),
);

function RetailGuard() {
  const token = getRetailToken();
  if (!token) {
    return <Navigate to="/retail/login" replace />;
  }
  return <Outlet />;
}

function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-app-bg text-text-contrast">
          Loading...
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/play" replace />} />

        <Route path="/play" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="betslip" element={<BetSlipPage />} />
          <Route path="fixture/:fixtureId" element={<FixtureMarketsPage />} />
          <Route path="track" element={<TicketTrackerPage />} />
          <Route path="1" element={<PlayVariant1Page />} />
          <Route path="2" element={<PlayVariant2Page />} />
          <Route path="3" element={<PlayVariant3Page />} />
          <Route path="4" element={<PlayVariant4Page />} />
          <Route path="5" element={<PlayVariant5Page />} />
        </Route>

        <Route path="/retail/login" element={<RetailLoginPage />} />
        <Route element={<RetailGuard />}>
          <Route path="/retail" element={<RetailLayout />}>
            <Route path="dashboard" element={<RetailDashboardPage />} />
            <Route index element={<Navigate to="/retail/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/play" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

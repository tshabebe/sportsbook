import { lazy, Suspense } from "react";
import { Navigate, Outlet, Routes, Route } from "react-router-dom";
import { getRetailToken } from "./lib/retailAuth";
import { getAdminToken } from "./lib/adminAuth";

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
const AdminLayout = lazy(() =>
  import("./components/layout/AdminLayout").then((m) => ({ default: m.AdminLayout })),
);
const AdminLoginPage = lazy(() =>
  import("./pages/admin/AdminLoginPage").then((m) => ({ default: m.AdminLoginPage })),
);
const AdminDashboardPage = lazy(() =>
  import("./pages/admin/AdminDashboardPage").then((m) => ({ default: m.AdminDashboardPage })),
);
const TicketTrackerPage = lazy(() =>
  import("./pages/play/TicketTrackerPage").then((m) => ({ default: m.TicketTrackerPage })),
);

function RetailGuard() {
  const token = getRetailToken();
  if (!token) {
    return <Navigate to="/retail/login" replace />;
  }
  return <Outlet />;
}

function AdminGuard() {
  const token = getAdminToken();
  if (!token) {
    return <Navigate to="/admin/login" replace />;
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
        </Route>

        <Route path="/retail/login" element={<RetailLoginPage />} />
        <Route element={<RetailGuard />}>
          <Route path="/retail" element={<RetailLayout />}>
            <Route path="dashboard" element={<RetailDashboardPage />} />
            <Route index element={<Navigate to="/retail/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route element={<AdminGuard />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/play" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;

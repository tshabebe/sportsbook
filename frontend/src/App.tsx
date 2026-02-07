import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { HomePage } from "./pages/HomePage";
import { BetSlipPage } from "./pages/BetSlipPage";
import { FixtureMarketsPage } from './pages/FixtureMarketsPage';
import { BetSlipProvider } from './context/BetSlipContext';

function App() {
  return (
    <BetSlipProvider>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="/betslip" element={<BetSlipPage />} />
          <Route path="/fixture/:fixtureId" element={<FixtureMarketsPage />} />
        </Route>
      </Routes>
    </BetSlipProvider>
  );
}

export default App;

import { Routes, Route } from "react-router-dom";
import { Layout } from "./components/layout/Layout";
import { HomePage } from "./pages/HomePage";
import { BetSlipPage } from "./pages/BetSlipPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="betslip" element={<BetSlipPage />} />
      </Route>
    </Routes>
  );
}

export default App;

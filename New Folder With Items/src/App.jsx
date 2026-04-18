import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DispatchPage } from "./pages/DispatchPage";
import { HomePage } from "./pages/HomePage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { JobsPage } from "./pages/JobsPage";
import { RevenuePage } from "./pages/RevenuePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TechniciansPage } from "./pages/TechniciansPage";

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/dispatch" element={<DispatchPage />} />
        <Route path="/communications" element={<CommunicationsPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/revenue" element={<RevenuePage />} />
        <Route path="/technicians" element={<TechniciansPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}

export default App;

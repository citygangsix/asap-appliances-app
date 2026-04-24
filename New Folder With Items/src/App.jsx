import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { AppShell } from "./components/layout/AppShell";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DispatchPage } from "./pages/DispatchPage";
import { HomePage } from "./pages/HomePage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { JobsPage } from "./pages/JobsPage";
import { LoginPage } from "./pages/LoginPage";
import { NewHiresCandidatesPage } from "./pages/NewHiresCandidatesPage";
import { PhonePage } from "./pages/PhonePage";
import { RevenuePage } from "./pages/RevenuePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TechniciansPage } from "./pages/TechniciansPage";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="dispatch" element={<DispatchPage />} />
          <Route path="communications" element={<CommunicationsPage />} />
          <Route path="phone" element={<PhonePage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="revenue" element={<RevenuePage />} />
          <Route path="technicians" element={<TechniciansPage />} />
          <Route path="new-hires-candidates" element={<NewHiresCandidatesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate replace to="/dashboard" />} />
      <Route path="/jobs" element={<Navigate replace to="/dashboard/jobs" />} />
      <Route path="/customers" element={<Navigate replace to="/dashboard/customers" />} />
      <Route path="/dispatch" element={<Navigate replace to="/dashboard/dispatch" />} />
      <Route path="/communications" element={<Navigate replace to="/dashboard/communications" />} />
      <Route path="/phone" element={<Navigate replace to="/dashboard/phone" />} />
      <Route path="/invoices" element={<Navigate replace to="/dashboard/invoices" />} />
      <Route path="/revenue" element={<Navigate replace to="/dashboard/revenue" />} />
      <Route path="/technicians" element={<Navigate replace to="/dashboard/technicians" />} />
      <Route path="/new-hires-candidates" element={<Navigate replace to="/dashboard/new-hires-candidates" />} />
      <Route path="/settings" element={<Navigate replace to="/dashboard/settings" />} />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );
}

export default App;

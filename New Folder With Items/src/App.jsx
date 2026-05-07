import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { ContactsPage } from "./pages/ContactsPage";
import { CustomersPage } from "./pages/CustomersPage";
import { DispatchPage } from "./pages/DispatchPage";
import { HomePage } from "./pages/HomePage";
import { InvoicesPage } from "./pages/InvoicesPage";
import { JobsPage } from "./pages/JobsPage";
import { NewHiresCandidatesPage } from "./pages/NewHiresCandidatesPage";
import { PhonePage } from "./pages/PhonePage";
import { RevenuePage } from "./pages/RevenuePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TechniciansPage } from "./pages/TechniciansPage";

function PublicWebsiteHome() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-6 text-[#151821]">
      <section className="w-full max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-600">
          ASAP Appliance
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal sm:text-6xl">
          Service website connected.
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
          The public site is live on ASAPACBoss.com.
        </p>
      </section>
    </main>
  );
}

function PublicNotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fb] px-6 text-[#151821]">
      <section className="w-full max-w-xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-indigo-600">
          ASAP Appliance
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-normal">Page not found.</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          Check the address and try again.
        </p>
      </section>
    </main>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/dashboard/login" element={<Navigate replace to="/dashboard/phone" />} />

      <Route path="/dashboard" element={<AppShell />}>
        <Route index element={<Navigate replace to="/dashboard/phone" />} />
        <Route path="home" element={<HomePage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="people" element={<ContactsPage />} />
        <Route path="contacts" element={<Navigate replace to="/dashboard/people" />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="dispatch" element={<Navigate replace to="/dashboard/phone" />} />
        <Route path="dispatch-board" element={<DispatchPage />} />
        <Route path="communications" element={<CommunicationsPage />} />
        <Route path="phone" element={<PhonePage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="revenue" element={<RevenuePage />} />
        <Route path="technicians" element={<TechniciansPage />} />
        <Route path="new-hires-candidates" element={<NewHiresCandidatesPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate replace to="/dashboard/phone" />} />
      </Route>

      <Route path="/" element={<Navigate replace to="/dashboard/phone" />} />
      <Route path="*" element={<PublicNotFoundPage />} />
    </Routes>
  );
}

export default App;

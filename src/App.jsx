import { useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { jobs } from "./data/mockData";
import { HomePage } from "./pages/HomePage";
import { JobsPage } from "./pages/JobsPage";
import { DispatchPage } from "./pages/DispatchPage";
import { CommunicationsPage } from "./pages/CommunicationsPage";
import { HiringPage } from "./pages/HiringPage";
import { TechniciansPage } from "./pages/TechniciansPage";
import { SettingsPage } from "./pages/SettingsPage";

function App() {
  const [activePage, setActivePage] = useState("home");
  const [mobileOpen, setMobileOpen] = useState(false);

  const pageMeta = useMemo(() => {
    const unresolvedCount = jobs.filter((job) => job.communication_status !== "clear").length;
    const lateCount = jobs.filter((job) => job.dispatch_status === "late").length;

    return {
      home: { eyebrow: "Operations overview", alert: `${lateCount} dispatch delays being watched` },
      jobs: { eyebrow: "Core workflow", alert: `${jobs.length} jobs in today’s working set` },
      dispatch: { eyebrow: "Field coordination", alert: `${lateCount} jobs need dispatch attention` },
      communications: { eyebrow: "Customer contact", alert: `${unresolvedCount} conversations unresolved` },
      hiring: { eyebrow: "Talent pipeline", alert: "2 candidates blocked on documents" },
      technicians: { eyebrow: "Field performance", alert: "1 technician running late" },
      settings: { eyebrow: "System setup", alert: "Mock placeholders only" },
    };
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case "jobs":
        return <JobsPage />;
      case "dispatch":
        return <DispatchPage />;
      case "communications":
        return <CommunicationsPage />;
      case "hiring":
        return <HiringPage />;
      case "technicians":
        return <TechniciansPage />;
      case "settings":
        return <SettingsPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6] md:flex">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <main className="min-h-screen flex-1 bg-[#eef1f6]">
        <div className="flex items-center justify-between border-b border-[#d8ddea] bg-white px-4 py-4 md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-[#cfd6e2] bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Menu
          </button>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              {pageMeta[activePage].eyebrow}
            </p>
            <p className="mt-1 text-sm text-slate-500">{pageMeta[activePage].alert}</p>
          </div>
        </div>

        {renderPage()}
      </main>
    </div>
  );
}

export default App;

import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { getRouteMeta } from "../../lib/constants/routes";
import { SidebarNav } from "../navigation/SidebarNav";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const routeMeta = getRouteMeta(location.pathname);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[#eef1f6] md:flex">
      <SidebarNav mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

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
              {routeMeta.eyebrow}
            </p>
            <p className="mt-1 text-sm text-slate-500">{routeMeta.alert}</p>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}

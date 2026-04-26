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

      <main className="min-h-screen min-w-0 flex-1 bg-[#eef1f6]">
        <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-[#d8ddea] bg-white px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-xl border border-[#cfd6e2] bg-white px-4 py-2 text-sm font-semibold text-slate-700"
            type="button"
          >
            Menu
          </button>
          <div className="min-w-0 flex-1 text-right">
            <p className="truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {routeMeta.eyebrow}
            </p>
            <p className="mt-1 truncate text-sm text-slate-500">{routeMeta.alert}</p>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}

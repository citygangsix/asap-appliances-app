import { NavLink } from "react-router-dom";
import { navigationGroups } from "../../lib/constants/routes";
import { logout } from "../../lib/auth/localAuth";

/**
 * @param {{ mobileOpen: boolean, setMobileOpen: (value: boolean) => void }} props
 */
export function SidebarNav({ mobileOpen, setMobileOpen }) {
  function handleLogout() {
    logout();
    window.location.assign("/dashboard/login");
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/45 transition md:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(300px,calc(100vw-40px))] flex-col border-r border-[#2a2d36] bg-[#1c1e26] pt-[env(safe-area-inset-top)] text-white transition md:static md:w-[272px] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="border-b border-[#2a2d36] px-5 py-5 md:px-7 md:py-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-indigo-500" />
                <p className="text-[17px] font-semibold tracking-[0.01em] text-white">ASAP Operations</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">Frontend demo only</p>
            </div>
            <button
              aria-label="Close navigation"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white md:hidden"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              Close
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto py-4 md:py-5">
          {navigationGroups.map((group) => (
            <div key={group.label} className="mb-5 md:mb-7">
              <p className="px-5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 md:px-7">
                {group.label}
              </p>
              <div className="mt-3 space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.itemId}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex min-h-12 w-full items-center gap-4 border-l-[3px] px-6 py-3 text-left text-[15px] font-semibold transition md:px-8 md:py-4 ${
                        isActive
                          ? "border-indigo-500 bg-indigo-500/14 text-white"
                          : "border-transparent text-slate-400 hover:bg-white/4 hover:text-white"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span className={`text-base ${isActive ? "text-slate-200" : "text-slate-500"}`}>
                          {item.icon}
                        </span>
                        {item.label}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="shrink-0 border-t border-[#2a2d36] px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:px-7">
          <button
            className="mb-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <div className="h-3 w-3 rounded-full bg-orange-400" />
            Protected dashboard
          </div>
        </div>
      </aside>
    </>
  );
}

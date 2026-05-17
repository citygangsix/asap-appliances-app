import { NavLink, useNavigate } from "react-router-dom";
import { navigationGroups } from "../../lib/constants/routes";
import { useDashboardAuth } from "../../lib/auth/dashboardAuth";

const mobileNavigationGroupOrder = ["Main", "People", "Operations", "System"];

function getMobileGroupOrder(label) {
  const orderIndex = mobileNavigationGroupOrder.indexOf(label);
  return orderIndex === -1 ? mobileNavigationGroupOrder.length : orderIndex;
}

function orderGroupsForMobile(groups) {
  return [...groups].sort(
    (firstGroup, secondGroup) =>
      getMobileGroupOrder(firstGroup.label) - getMobileGroupOrder(secondGroup.label),
  );
}

function NavigationGroupList({ groups, setMobileOpen }) {
  return groups.map((group) => (
    <div key={group.label} className="mb-4 last:mb-0 md:mb-7">
      <p className="px-5 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 md:px-7">
        {group.label}
      </p>
      <div className="mt-2 space-y-0.5 md:mt-3">
        {group.items.map((item) => (
          <NavLink
            key={item.itemId}
            to={item.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex min-h-11 w-full items-center gap-4 border-l-[3px] px-6 py-2.5 text-left text-[15px] font-semibold transition md:min-h-12 md:px-8 md:py-4 ${
                isActive
                  ? "border-indigo-500 bg-indigo-500/14 text-white"
                  : "border-transparent text-slate-400 hover:bg-white/4 hover:text-white"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={`text-base ${isActive ? "text-slate-200" : "text-slate-500"}`}>{item.icon}</span>
                <span className="min-w-0 leading-tight">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  ));
}

function SidebarContent({ groups, setMobileOpen, onLogout, showCloseButton = false }) {
  return (
    <>
      <div className="border-b border-[#2a2d36] px-5 py-4 md:px-7 md:py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-4 rounded-full bg-indigo-500" />
              <p className="text-[17px] font-semibold tracking-[0.01em] text-white">ASAP Operations</p>
            </div>
            <p className="mt-2 text-sm text-slate-500">Live operations CRM</p>
          </div>
          {showCloseButton ? (
            <button
              aria-label="Close navigation menu"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              Close
            </button>
          ) : null}
        </div>
      </div>

      <nav aria-label="Dashboard navigation" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-3 md:py-5">
        <NavigationGroupList groups={groups} setMobileOpen={setMobileOpen} />
      </nav>

      <div className="shrink-0 border-t border-[#2a2d36] px-5 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-7 md:py-4 md:pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <button
          className="mb-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm font-semibold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
          onClick={onLogout}
          type="button"
        >
          Logout
        </button>
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <div className="h-3 w-3 rounded-full bg-orange-400" />
          Protected dashboard
        </div>
      </div>
    </>
  );
}

/**
 * @param {{ mobileOpen: boolean, setMobileOpen: (value: boolean) => void }} props
 */
export function SidebarNav({ mobileOpen, setMobileOpen }) {
  const auth = useDashboardAuth();
  const navigate = useNavigate();
  const mobileNavigationGroups = orderGroupsForMobile(navigationGroups);

  async function handleLogout() {
    await auth.signOut();
    navigate("/dashboard/login", { replace: true });
  }

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-30 bg-slate-950/45 transition md:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        aria-hidden={mobileOpen ? undefined : "true"}
        aria-label="Mobile navigation menu"
        aria-modal="true"
        className={`fixed left-0 top-0 z-40 flex h-dvh max-h-dvh w-[min(300px,calc(100vw-40px))] flex-col overflow-hidden border-r border-[#2a2d36] bg-[#1c1e26] pt-[env(safe-area-inset-top)] text-white transition md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        id="dashboard-mobile-navigation"
        role="dialog"
        {...(mobileOpen ? {} : { inert: "" })}
      >
        <SidebarContent
          groups={mobileNavigationGroups}
          onLogout={handleLogout}
          setMobileOpen={setMobileOpen}
          showCloseButton
        />
      </aside>

      <aside className="hidden min-h-screen w-[272px] flex-col overflow-hidden border-r border-[#2a2d36] bg-[#1c1e26] pt-[env(safe-area-inset-top)] text-white md:flex">
        <SidebarContent
          groups={navigationGroups}
          onLogout={handleLogout}
          setMobileOpen={setMobileOpen}
        />
      </aside>
    </>
  );
}

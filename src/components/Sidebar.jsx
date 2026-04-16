import { navItems } from "../data/mockData";

const navGroups = [
  {
    label: "Main",
    items: navItems.filter((item) => ["home", "jobs", "dispatch", "communications"].includes(item.id)),
  },
  {
    label: "People",
    items: navItems.filter((item) => ["hiring", "technicians"].includes(item.id)),
  },
  {
    label: "System",
    items: navItems.filter((item) => item.id === "settings"),
  },
];

export function Sidebar({ activePage, setActivePage, mobileOpen, setMobileOpen }) {
  return (
    <>
      <div
        className={`fixed inset-0 z-30 bg-slate-950/45 transition md:hidden ${
          mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setMobileOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-[#2a2d36] bg-[#1c1e26] text-white transition md:static md:w-[272px] ${
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="border-b border-[#2a2d36] px-7 py-8">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-3">
                <div className="h-4 w-4 rounded-full bg-indigo-500" />
                <p className="text-[17px] font-semibold tracking-[0.01em] text-white">ASAP Operations</p>
              </div>
              <p className="mt-2 text-sm text-slate-500">Frontend demo only</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-5">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-7">
              <p className="px-7 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                {group.label}
              </p>
              <div className="mt-3 space-y-0.5">
                {group.items.map((item) => {
                  const active = activePage === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActivePage(item.id);
                        setMobileOpen(false);
                      }}
                      className={`flex w-full items-center gap-4 border-l-[3px] px-8 py-4 text-left text-[15px] font-semibold transition ${
                        active
                          ? "border-indigo-500 bg-indigo-500/14 text-white"
                          : "border-transparent text-slate-400 hover:bg-white/4 hover:text-white"
                      }`}
                    >
                      <span className={`text-base ${active ? "text-slate-200" : "text-slate-500"}`}>
                        {item.icon}
                      </span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-[#2a2d36] px-7 py-4">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <div className="h-3 w-3 rounded-full bg-orange-400" />
            Mock data active
          </div>
        </div>
      </aside>
    </>
  );
}

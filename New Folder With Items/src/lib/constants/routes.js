/** @typedef {import("../../types/models").RouteMeta} RouteMeta */
/** @typedef {import("../../types/models").SidebarItem} SidebarItem */

/** @type {RouteMeta[]} */
export const ROUTES = [
  {
    routeId: "home",
    path: "/dashboard/home",
    label: "Overview",
    icon: "◫",
    group: "Main",
    eyebrow: "Operations overview",
    alert: "Command center and urgent queues",
  },
  {
    routeId: "jobs",
    path: "/dashboard/jobs",
    label: "Jobs",
    icon: "▣",
    group: "Main",
    eyebrow: "Core workflow",
    alert: "Separate state tracking for every service job",
  },
  {
    routeId: "phone",
    path: "/dashboard/phone",
    label: "Phone",
    icon: "☎",
    group: "Main",
    eyebrow: "Quick SignalWire access",
    alert: "Type a number and start a call",
  },
  {
    routeId: "people",
    path: "/dashboard/people",
    label: "People",
    icon: "☷",
    group: "Main",
    eyebrow: "People directory",
    alert: "Customers, technicians, candidates, and review contacts",
  },
  {
    routeId: "customers",
    path: "/dashboard/customers",
    label: "Customers",
    icon: "◎",
    group: "Main",
    eyebrow: "Customer record",
    alert: "Contact health, balances, and service history",
  },
  {
    routeId: "dispatch",
    path: "/dashboard/dispatch-board",
    label: "Dispatch",
    icon: "⇄",
    group: "Operations",
    eyebrow: "Field coordination",
    alert: "Assignment pressure and ETA confidence",
  },
  {
    routeId: "communications",
    path: "/dashboard/communications",
    label: "Communications",
    icon: "✆",
    group: "Operations",
    eyebrow: "Customer contact",
    alert: "Texts, calls, and extracted event review",
  },
  {
    routeId: "invoices",
    path: "/dashboard/invoices",
    label: "Invoices",
    icon: "$",
    group: "Operations",
    eyebrow: "Collections",
    alert: "Open balances, failed payments, and deposits",
  },
  {
    routeId: "revenue",
    path: "/dashboard/revenue",
    label: "Revenue",
    icon: "◔",
    group: "Operations",
    eyebrow: "Financial view",
    alert: "Booked revenue, collections, and technician payouts",
  },
  {
    routeId: "technicians",
    path: "/dashboard/technicians",
    label: "Technicians",
    icon: "⚙",
    group: "People",
    eyebrow: "Field performance",
    alert: "Roster status, scorecards, and payout visibility",
  },
  {
    routeId: "new-hires-candidates",
    path: "/dashboard/new-hires-candidates",
    label: "New Hires Candidates",
    icon: "✓",
    group: "People",
    eyebrow: "Recruiting CRM",
    alert: "Recorded hiring calls and hired technician checks",
  },
  {
    routeId: "settings",
    path: "/dashboard/settings",
    label: "Settings",
    icon: "⋯",
    group: "System",
    eyebrow: "System setup",
    alert: "Company defaults and future integrations",
  },
];

/** @type {Array<{label: string, items: SidebarItem[]}>} */
export const navigationGroups = ["Main", "Operations", "People", "System"].map((groupLabel) => ({
  label: groupLabel,
  items: ROUTES.filter((route) => route.group === groupLabel).map((route) => ({
    itemId: route.routeId,
    label: route.label,
    path: route.path,
    icon: route.icon,
    group: route.group,
  })),
}));

export function getRouteMeta(pathname) {
  return ROUTES.find((route) => route.path === pathname) || ROUTES[0];
}

/** @typedef {import("../../types/models").RouteMeta} RouteMeta */
/** @typedef {import("../../types/models").SidebarItem} SidebarItem */

/** @type {RouteMeta[]} */
export const ROUTES = [
  {
    routeId: "home",
    path: "/",
    label: "Home",
    icon: "◫",
    group: "Main",
    eyebrow: "Operations overview",
    alert: "Command center and urgent queues",
  },
  {
    routeId: "jobs",
    path: "/jobs",
    label: "Jobs",
    icon: "▣",
    group: "Main",
    eyebrow: "Core workflow",
    alert: "Separate state tracking for every service job",
  },
  {
    routeId: "customers",
    path: "/customers",
    label: "Customers",
    icon: "◎",
    group: "Main",
    eyebrow: "Customer record",
    alert: "Contact health, balances, and service history",
  },
  {
    routeId: "dispatch",
    path: "/dispatch",
    label: "Dispatch",
    icon: "⇄",
    group: "Operations",
    eyebrow: "Field coordination",
    alert: "Assignment pressure and ETA confidence",
  },
  {
    routeId: "communications",
    path: "/communications",
    label: "Communications",
    icon: "✆",
    group: "Operations",
    eyebrow: "Customer contact",
    alert: "Texts, calls, and extracted event review",
  },
  {
    routeId: "invoices",
    path: "/invoices",
    label: "Invoices",
    icon: "$",
    group: "Operations",
    eyebrow: "Collections",
    alert: "Open balances, failed payments, and deposits",
  },
  {
    routeId: "revenue",
    path: "/revenue",
    label: "Revenue",
    icon: "◔",
    group: "Operations",
    eyebrow: "Financial view",
    alert: "Booked revenue, collections, and technician payouts",
  },
  {
    routeId: "technicians",
    path: "/technicians",
    label: "Technicians",
    icon: "⚙",
    group: "People",
    eyebrow: "Field performance",
    alert: "Roster status, scorecards, and payout visibility",
  },
  {
    routeId: "settings",
    path: "/settings",
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

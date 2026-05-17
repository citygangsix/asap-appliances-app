import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagesDist = path.join(repoRoot, "dist-pages");

const expectedRoutes = [
  "/",
  "/confirmations/",
  "/privacy-policy/",
  "/terms-and-conditions/",
  "/dashboard/",
  "/dashboard/login/",
  "/dashboard/phone/",
  "/dashboard/people/",
  "/dashboard/contacts/",
  "/dashboard/jobs/",
  "/dashboard/dispatch/",
  "/dashboard/dispatch-board/",
  "/dashboard/communications/",
  "/dashboard/customers/",
  "/dashboard/invoices/",
  "/dashboard/revenue/",
  "/dashboard/technicians/",
  "/dashboard/new-hires-candidates/",
  "/dashboard/settings/",
  "/dashboard/home/",
];

function routeToIndexPath(route) {
  const routePath = route === "/" ? "index.html" : path.join(route.replace(/^\/|\/$/gu, ""), "index.html");
  return path.join(pagesDist, routePath);
}

async function routeExists(route) {
  try {
    await access(routeToIndexPath(route));
    return true;
  } catch (error) {
    return false;
  }
}

const results = await Promise.all(
  expectedRoutes.map(async (route) => ({
    route,
    ok: await routeExists(route),
  })),
);
const failedRoutes = results.filter((result) => !result.ok);

for (const result of results) {
  console.log(`${result.ok ? "OK  " : "MISS"} ${result.route}`);
}

if (failedRoutes.length > 0) {
  console.error(`Missing ${failedRoutes.length} dist-pages route(s).`);
  process.exitCode = 1;
}

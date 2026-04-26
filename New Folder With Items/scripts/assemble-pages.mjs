import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteDist = path.join(repoRoot, "dist-site");
const dashboardDist = path.join(repoRoot, "dist-dashboard");
const pagesDist = path.join(repoRoot, "dist-pages");
const dashboardPagesDist = path.join(pagesDist, "dashboard");
const dashboardDirectRoutes = [
  "jobs",
  "customers",
  "dispatch",
  "communications",
  "phone",
  "invoices",
  "revenue",
  "technicians",
  "new-hires-candidates",
  "settings",
];

const dashboardSpaFallback = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ASAP Operations</title>
  </head>
  <body>
    <script>
      (function () {
        sessionStorage.setItem("asap-crm-spa-redirect", window.location.href);
        window.location.replace("/dashboard/");
      })();
    </script>
  </body>
</html>
`;

const rootFallback = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ASAP AC and Appliance</title>
  </head>
  <body>
    <script>
      (function () {
        if (window.location.pathname.indexOf("/dashboard") === 0) {
          sessionStorage.setItem("asap-crm-spa-redirect", window.location.href);
          window.location.replace("/dashboard/");
          return;
        }

        window.location.replace("/");
      })();
    </script>
  </body>
</html>
`;

await rm(pagesDist, { recursive: true, force: true });
await mkdir(pagesDist, { recursive: true });
await cp(siteDist, pagesDist, { recursive: true });
await mkdir(dashboardPagesDist, { recursive: true });
await cp(dashboardDist, dashboardPagesDist, { recursive: true });
await rm(path.join(dashboardPagesDist, "CNAME"), { force: true });

await writeFile(path.join(pagesDist, "CNAME"), "ASAPACBoss.com\n");
await writeFile(path.join(pagesDist, ".nojekyll"), "");
await writeFile(path.join(pagesDist, "404.html"), rootFallback);
await writeFile(path.join(dashboardPagesDist, "404.html"), dashboardSpaFallback);

for (const route of dashboardDirectRoutes) {
  const routeDist = path.join(dashboardPagesDist, route);
  await mkdir(routeDist, { recursive: true });
  await cp(path.join(dashboardPagesDist, "index.html"), path.join(routeDist, "index.html"));
}

import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const functionRepoRoot = path.join(
  repoRoot,
  "supabase/functions/asap-crm/_repo",
);

const copies = [
  ["server/lib", "server/lib"],
  ["src/integrations/supabase", "src/integrations/supabase"],
  ["src/types", "src/types"],
];

await rm(functionRepoRoot, { recursive: true, force: true });
await mkdir(functionRepoRoot, { recursive: true });

for (const [source, destination] of copies) {
  await cp(
    path.join(repoRoot, source),
    path.join(functionRepoRoot, destination),
    {
      recursive: true,
    },
  );
}

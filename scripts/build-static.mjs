// Copies just the static app into dist/ for static hosting (Cloudflare
// Pages). Deliberately excludes worker/, tests/, docs/, node_modules/,
// serve.mjs and the .bat — Pages would otherwise try to upload the build
// env's node_modules (workerd ~119 MiB) and hit the 25 MiB asset limit.
//
// Zero dependencies, matches the project's "node script, no deps" style.
//   Cloudflare Pages → Build command: npm run build · Output dir: dist

import { rmSync, mkdirSync, cpSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

const FILES = ["index.html", "styles.css", "manifest.webmanifest", "sw.js"];
const DIRS = ["js", "assets"];

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const file of FILES) {
  cpSync(join(root, file), join(dist, file));
}
for (const dir of DIRS) {
  cpSync(join(root, dir), join(dist, dir), { recursive: true });
}

console.log(`Built static site -> dist/ (${FILES.length} files, ${DIRS.join(", ")})`);

// Next creates symlinks in <distDir>/node_modules for serverExternalPackages.
// The deploy archiver rejects directory symlinks, so replace them with real copies.
// Copying whole packages also pulls large development-only files into the archive;
// prune those after dereferencing so the platform's dist validation stays bounded.
import {
  readdirSync,
  lstatSync,
  realpathSync,
  rmSync,
  cpSync,
  existsSync,
  statSync,
} from "node:fs";
import { join } from "node:path";

function prepare(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      const target = realpathSync(p);
      rmSync(p);
      cpSync(target, p, { recursive: true, dereference: true });
      console.log(`dereferenced ${p}`);
      prepare(p);
    } else if (st.isDirectory()) {
      if (entry === ".yarn" || entry === "docs" || entry === "examples") {
        rmSync(p, { recursive: true, force: true });
      } else {
        prepare(p);
      }
    } else if (entry.endsWith(".map")) {
      rmSync(p, { force: true });
    }
  }
}

const root = join(process.cwd(), process.env.NEXT_DIST_DIR || "dist");
if (!existsSync(root)) {
  throw new Error(`Build output was not created at ${root}`);
}

prepare(root);

// Build diagnostics and caches are not used by the production server and only
// add noise to the uploaded artifact.
for (const disposable of ["cache", "trace", "trace-build"]) {
  rmSync(join(root, disposable), { recursive: true, force: true });
}

// The build runs on glibc Linux. pdf-parse includes an additional musl canvas
// binary that cannot load on this target and adds roughly 28 MB to the archive.
for (const packageDir of readdirSync(join(root, "node_modules"))) {
  if (!packageDir.startsWith("pdf-parse-")) continue;
  const muslCanvas = join(
    root,
    "node_modules",
    packageDir,
    "node_modules",
    "@napi-rs",
    "canvas",
    "node_modules",
    "@napi-rs",
    "canvas-linux-x64-musl",
  );
  rmSync(muslCanvas, { recursive: true, force: true });
}

for (const required of ["BUILD_ID", "required-server-files.json", "server", "static"]) {
  if (!existsSync(join(root, required))) {
    throw new Error(`Incomplete Next.js build: missing ${required}`);
  }
}

const remainingLinks = [];
function collectLinks(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) remainingLinks.push(p);
    else if (st.isDirectory()) collectLinks(p);
  }
}
collectLinks(root);
if (remainingLinks.length > 0) {
  throw new Error(`Build output still contains symlinks:\n${remainingLinks.join("\n")}`);
}

function directorySize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    total += st.isDirectory() ? directorySize(p) : st.size;
  }
  return total;
}

console.log(`deployment output ready (${Math.ceil(directorySize(root) / 1024 / 1024)} MB)`);

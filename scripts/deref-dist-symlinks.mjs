// Next creates symlinks in <distDir>/node_modules for serverExternalPackages.
// The deploy archiver rejects directory symlinks, so replace them with real copies.
import { readdirSync, lstatSync, realpathSync, rmSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

const dir = join(process.cwd(), process.env.NEXT_DIST_DIR || "dist", "node_modules");
if (existsSync(dir)) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (!lstatSync(p).isSymbolicLink()) continue;
    const target = realpathSync(p);
    rmSync(p);
    cpSync(target, p, { recursive: true, dereference: true });
    console.log(`dereferenced ${entry}`);
  }
}

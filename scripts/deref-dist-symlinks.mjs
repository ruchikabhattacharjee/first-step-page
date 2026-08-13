// Next creates symlinks in <distDir>/node_modules for serverExternalPackages.
// The deploy archiver rejects directory symlinks, so replace them with real copies.
import { readdirSync, lstatSync, realpathSync, rmSync, cpSync, existsSync } from "node:fs";
import { join } from "node:path";

function deref(dir) {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) {
      const target = realpathSync(p);
      rmSync(p);
      cpSync(target, p, { recursive: true, dereference: true });
      console.log(`dereferenced ${p}`);
    } else if (st.isDirectory()) {
      deref(p);
    }
  }
}

const root = join(process.cwd(), process.env.NEXT_DIST_DIR || "dist");
if (existsSync(root)) deref(root);

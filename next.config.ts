import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build output dir: the platform's post-build check looks for `dist/`.
  // Dev keeps the default `.next` so the running dev server is unaffected.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // Keep heavy native/Node-only PDF + OCR libs out of the bundler so they load
  // from node_modules at runtime (Turbopack can't bundle the native canvas).
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas', 'tesseract.js', 'pdfkit'],
};

export default nextConfig;

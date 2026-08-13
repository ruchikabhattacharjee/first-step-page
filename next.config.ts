import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep heavy native/Node-only PDF + OCR libs out of the bundler so they load
  // from node_modules at runtime (Turbopack can't bundle the native canvas).
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist', '@napi-rs/canvas', 'tesseract.js', 'pdfkit'],
};

export default nextConfig;

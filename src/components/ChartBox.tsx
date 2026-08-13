'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Fixed-height chart wrapper that renders its (Recharts) children only after the
 * component has mounted in the browser. Recharts' ResponsiveContainer measures
 * its parent's size, which is impossible during server-side rendering and logs
 * a "width(-1) height(-1)" warning. Deferring to client mount — when real layout
 * exists — avoids that, and the reserved height prevents any layout shift.
 */
export function ChartBox({ height, className, children }: { height: number; className?: string; children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <div style={{ width: '100%', height }} className={className}>
      {mounted ? children : null}
    </div>
  );
}

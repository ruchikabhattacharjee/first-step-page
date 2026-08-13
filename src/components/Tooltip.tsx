'use client';

import React, { ReactNode, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpCircle } from 'lucide-react';
import './Tooltip.css';

interface TooltipProps {
  content: string;
  children?: ReactNode;
}

const TOOLTIP_WIDTH = 240;
const MARGIN = 8;

/**
 * Help tooltip rendered in a fixed-position portal on <body>, so it is never
 * clipped by an `overflow: hidden` ancestor (the dashboard cards) and never
 * runs off the screen edge (the invoices table) — it clamps to the viewport.
 */
export const HelpTooltip = ({ content, children }: TooltipProps) => {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    let left = r.left + r.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - MARGIN));
    setPos({ top: r.top - MARGIN, left });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={anchorRef}
      className="tooltip-container"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      tabIndex={0}
    >
      {children || <HelpCircle size={16} className="text-muted tooltip-icon" />}
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span className="tooltip-floating" style={{ top: pos.top, left: pos.left, width: TOOLTIP_WIDTH }}>
            {content}
          </span>,
          document.body
        )}
    </span>
  );
};

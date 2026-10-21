"use client";

import { useRef, useState } from "react";

interface ResizeHandleProps {
  /** Current width in px, read once when a drag starts. */
  getWidth: () => number;
  setWidth: (width: number) => void;
  label: string;
  /** Double-click resets to this value. */
  resetTo?: number;
  /** Lower bound reported to assistive tech (px). */
  min?: number;
  /** Upper bound reported to assistive tech (px). */
  max?: number;
  style?: React.CSSProperties;
  /** Which edge of the panel this handle is on. Default is "right". Use "left" for right-anchored sidebars/drawers. */
  edge?: "left" | "right";
}

/**
 * A vertical separator you can drag with the pointer or nudge with the arrow
 * keys. Alignment in this app is meant to be adjustable, so every panel that
 * has a width gets one of these.
 */
export function ResizeHandle({
  getWidth,
  setWidth,
  label,
  resetTo,
  min = 0,
  max = 1000,
  style,
  edge = "right",
}: ResizeHandleProps) {
  const base = useRef(0);
  const startX = useRef(0);
  const [active, setActive] = useState(false);

  const edgeStyle = edge === "left" ? { left: -3 } : { right: -3 };

  return (
    <div
      className="resize-x"
      data-active={active}
      style={{ ...edgeStyle, ...style }}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(getWidth())}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      title={`${label} — drag, or use arrow keys`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        base.current = getWidth();
        startX.current = e.clientX;
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!active) return;
        const delta = edge === "left" ? (startX.current - e.clientX) : (e.clientX - startX.current);
        const next = Math.max(min, Math.min(max, base.current + delta));
        setWidth(next);
      }}
      onPointerUp={() => setActive(false)}
      onPointerCancel={() => setActive(false)}
      onDoubleClick={() => resetTo !== undefined && setWidth(resetTo)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 32 : 8;
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          const next = edge === "left" ? getWidth() + step : getWidth() - step;
          setWidth(Math.max(min, Math.min(max, next)));
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          const next = edge === "left" ? getWidth() - step : getWidth() + step;
          setWidth(Math.max(min, Math.min(max, next)));
        } else if (e.key === "Home" && resetTo !== undefined) {
          e.preventDefault();
          setWidth(resetTo);
        }
      }}
    />
  );
}

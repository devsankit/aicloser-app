"use client";

import { useEffect } from "react";
import { Icon } from "@/components/ui/Icon";
import { Keys, SHORTCUT_GROUPS } from "./Kbd";
import { useApp } from "@/lib/store";

export function ShortcutSheet() {
  const { setSheet } = useApp();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSheet(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSheet]);

  return (
    <div className="overlay" data-kind="dialog" onClick={() => setSheet(false)} role="presentation">
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="dialog-head">
          <span className="empty-icon" style={{ width: 28, height: 28, marginBottom: 0 }}>
            <Icon name="keyboard" size={15} />
          </span>
          <h2>Keyboard shortcuts</h2>
          <button
            className="icon-btn"
            onClick={() => setSheet(false)}
            aria-label="Close shortcuts"
            style={{ marginLeft: "auto" }}
          >
            <Icon name="close" size={15} />
          </button>
        </header>

        <div className="sheet-body">
          {SHORTCUT_GROUPS.map((group) => (
            <div className="sheet-col" key={group.title}>
              <h3>{group.title}</h3>
              {group.items.map((item) => (
                <div className="sheet-item" key={item.label}>
                  <span>{item.label}</span>
                  <Keys parts={item.keys} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

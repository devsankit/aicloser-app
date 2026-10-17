"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { AddLeadDialog } from "@/components/pipeline/AddLeadDialog";
import { CommandPalette } from "./CommandPalette";
import { ShortcutSheet } from "./ShortcutSheet";
import { useApp } from "@/lib/store";

const CHORD_MS = 1200;

/** true when the event target is a field the user is typing into. */
function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return (
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT" ||
    el.isContentEditable === true
  );
}

export function KeyboardProvider() {
  const { state, setPalette, setSheet, setQuickAdd, toggleSidebar, setTheme } = useApp();
  const router = useRouter();
  const chord = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Command menu works everywhere, even while typing.
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(!state.paletteOpen);
        return;
      }

      if (e.key === "Escape") {
        if (state.paletteOpen) setPalette(false);
        if (state.sheetOpen) setSheet(false);
        return;
      }

      // Overlays own the rest of the keyboard while they are open.
      if (state.paletteOpen || state.sheetOpen) return;
      if (isTyping(e.target) || mod || e.altKey) return;

      const key = e.key.toLowerCase();

      // g-prefixed navigation chords
      if (chord.current && Date.now() - chord.current.at < CHORD_MS && chord.current.key === "g") {
        chord.current = null;
        const destinations: Record<string, string> = {
          d: "/dashboard",
          p: "/pipeline",
          c: "/contacts",
          s: "/settings",
          t: "/team",
        };
        const href = destinations[key];
        if (href) {
          e.preventDefault();
          router.push(href);
          return;
        }
      }

      if (key === "g") {
        chord.current = { key: "g", at: Date.now() };
        return;
      }

      if (key === "?" || (e.shiftKey && key === "/")) {
        e.preventDefault();
        setSheet(true);
      } else if (key === "c") {
        e.preventDefault();
        setQuickAdd(true);
      } else if (key === "/") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("closer:focus-search"));
      } else if (key === "[") {
        e.preventDefault();
        toggleSidebar();
      } else if (key === "t") {
        e.preventDefault();
        setTheme(state.theme === "dark" ? "light" : "dark");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    router,
    setPalette,
    setQuickAdd,
    setSheet,
    setTheme,
    state.paletteOpen,
    state.sheetOpen,
    state.theme,
    toggleSidebar,
  ]);

  return (
    <>
      {state.paletteOpen ? <CommandPalette /> : null}
      {state.sheetOpen ? <ShortcutSheet /> : null}
      {state.quickAddOpen ? (
        <AddLeadDialog defaultStage="new" onClose={() => setQuickAdd(false)} />
      ) : null}
    </>
  );
}

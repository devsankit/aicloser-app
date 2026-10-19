"use client";

import { useEffect, useState } from "react";
import { modKey } from "@/lib/store";

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

/** Renders a shortcut from its platform-neutral parts, e.g. ["mod","K"]. */
export function Keys({ parts }: { parts: string[] }) {
  const [mod, setMod] = useState("⌘");
  useEffect(() => {
    setMod(modKey());
  }, []);
  return (
    <span className="key-hint">
      {parts.map((p, i) => (
        <Kbd key={`${p}-${i}`}>{p === "mod" ? mod : p}</Kbd>
      ))}
    </span>
  );
}

export interface Shortcut {
  keys: string[];
  label: string;
}

export const SHORTCUT_GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "General",
    items: [
      { keys: ["mod", "K"], label: "Open command menu" },
      { keys: ["C"], label: "Create lead" },
      { keys: ["/"], label: "Focus search" },
      { keys: ["?"], label: "Keyboard shortcuts" },
      { keys: ["["], label: "Toggle sidebar" },
      { keys: ["T"], label: "Switch light / dark" },
    ],
  },
  {
    title: "Navigation",
    items: [
      { keys: ["G", "D"], label: "Go to dashboard" },
      { keys: ["G", "P"], label: "Go to pipeline" },
      { keys: ["G", "C"], label: "Go to contacts" },
      { keys: ["G", "S"], label: "Go to settings" },
    ],
  },
  {
    title: "Lists",
    items: [
      { keys: ["J"], label: "Next item" },
      { keys: ["K"], label: "Previous item" },
      { keys: ["Enter"], label: "Open selected" },
      { keys: ["X"], label: "Toggle selection" },
      { keys: ["Esc"], label: "Close panel" },
    ],
  },
  {
    title: "Board",
    items: [
      { keys: ["←", "→"], label: "Walk columns" },
      { keys: ["⇧", "←"], label: "Move lead back" },
      { keys: ["⇧", "→"], label: "Move lead forward" },
      { keys: ["⌥", "drag"], label: "Resize column / sidebar" },
    ],
  },
];

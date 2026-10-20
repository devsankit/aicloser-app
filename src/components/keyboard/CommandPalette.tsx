"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";
import { NAV } from "@/lib/nav";
import { Keys } from "./Kbd";
import { CURRENT_USER, useApp } from "@/lib/store";

interface Command {
  id: string;
  label: string;
  group: string;
  icon: IconName;
  hint?: string[];
  sub?: string;
  run: () => void;
}

export function CommandPalette() {
  const { state, setPalette, setTheme, setDensity, toggleSidebar, reset } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const close = () => setPalette(false);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = NAV.flatMap((g) => g.items).map((item) => ({
      id: `nav-${item.href}`,
      label: item.label,
      group: "Navigate",
      icon: item.icon,
      run: () => router.push(item.href),
    }));

    const actions: Command[] = [
      {
        id: "act-theme",
        label: state.theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
        group: "Actions",
        icon: state.theme === "dark" ? "sun" : "moon",
        hint: ["T"],
        run: () => setTheme(state.theme === "dark" ? "light" : "dark"),
      },
      {
        id: "act-density",
        label: state.density === "compact" ? "Comfortable density" : "Compact density",
        group: "Actions",
        icon: "layers",
        run: () => setDensity(state.density === "compact" ? "comfortable" : "compact"),
      },
      {
        id: "act-sidebar",
        label: state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar",
        group: "Actions",
        icon: "panel",
        hint: ["["],
        run: toggleSidebar,
      },
      {
        id: "act-export",
        label: "Export leads as JSON",
        group: "Actions",
        icon: "download",
        run: () => router.push("/settings"),
      },
      {
        id: "act-reset",
        label: "Reset demo data",
        group: "Actions",
        icon: "trash",
        sub: "Restores the seeded leads",
        run: reset,
      },
    ];

    const leads: Command[] = state.leads.slice(0, 40).map((l) => ({
      id: `lead-${l.id}`,
      label: l.name,
      group: "Leads",
      icon: "users",
      sub: `${l.code} · ${l.company} · ${l.phone}`,
      run: () => router.push("/contacts"),
    }));

    const availableOwners = Array.from(new Set([CURRENT_USER, "Unassigned", ...state.leads.map((l) => l.owner).filter(Boolean)]));
    const assignees: Command[] = availableOwners.map((owner) => ({
      id: `owner-${owner}`,
      label: `Leads owned by ${owner}`,
      group: "Filter",
      icon: "target",
      run: () => router.push("/contacts"),
    }));

    return [...actions, ...nav, ...assignees, ...leads];
  }, [
    router,
    setDensity,
    setTheme,
    state.leads,
    state.density,
    state.sidebarCollapsed,
    state.theme,
    toggleSidebar,
    reset,
  ]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.filter((c) => c.group === "Actions" || c.group === "Navigate");
    return commands
      .filter(
        (c) =>
          c.label.toLowerCase().includes(q) ||
          (c.sub ?? "").toLowerCase().includes(q) ||
          c.group.toLowerCase().includes(q),
      )
      .slice(0, 24);
  }, [commands, query]);

  const groups = useMemo(() => {
    const map = new Map<string, Command[]>();
    for (const c of results) map.set(c.group, [...(map.get(c.group) ?? []), c]);
    return [...map.entries()];
  }, [results]);

  const flat = useMemo(() => groups.flatMap(([, items]) => items), [groups]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const runAt = (index: number) => {
    const cmd = flat[index];
    if (!cmd) return;
    close();
    cmd.run();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown" || (e.key === "n" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (i + 1) % Math.max(1, flat.length));
    } else if (e.key === "ArrowUp" || (e.key === "p" && e.ctrlKey)) {
      e.preventDefault();
      setActive((i) => (i - 1 + flat.length) % Math.max(1, flat.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(active);
    }
  };

  let index = -1;

  return (
    <div className="overlay palette-wrap" onClick={close} role="presentation">
      <div
        className="palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="palette-input">
          <Icon name="search" size={15} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads, pages and actions…"
            aria-label="Command menu input"
            aria-controls="command-results"
          />
          <Keys parts={["Esc"]} />
        </div>

        <div className="palette-list" id="command-results" ref={listRef} role="listbox">
          {groups.map(([group, items]) => (
            <div key={group}>
              <p className="palette-group">{group}</p>
              {items.map((cmd) => {
                index += 1;
                const idx = index;
                return (
                  <button
                    key={cmd.id}
                    data-idx={idx}
                    data-active={idx === active}
                    className="palette-item"
                    role="option"
                    aria-selected={idx === active}
                    onMouseMove={() => setActive(idx)}
                    onClick={() => runAt(idx)}
                  >
                    <Icon name={cmd.icon} size={15} />
                    <span>
                      {cmd.label}
                      {cmd.sub ? <span className="palette-sub"> — {cmd.sub}</span> : null}
                    </span>
                    <span className="pi-meta">
                      {cmd.hint ? <Keys parts={cmd.hint} /> : null}
                      {idx === active ? <Icon name="arrow-right" size={13} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {!flat.length ? <p className="palette-sub" style={{ padding: "14px 10px" }}>No results for “{query}”.</p> : null}
        </div>

        <div className="palette-foot">
          <span className="key-hint">
            <Keys parts={["↑", "↓"]} /> navigate
          </span>
          <span className="key-hint">
            <Keys parts={["↵"]} /> open
          </span>
          <span className="key-hint">
            <Keys parts={["Esc"]} /> close
          </span>
          <span style={{ marginLeft: "auto" }}>Signed in as {CURRENT_USER}</span>
        </div>
      </div>
    </div>
  );
}

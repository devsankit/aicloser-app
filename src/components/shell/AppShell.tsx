"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { KeyboardProvider } from "@/components/keyboard/KeyboardProvider";
import { Kbd } from "@/components/keyboard/Kbd";
import { NAV } from "@/lib/data";
import { CURRENT_USER, LIMITS, useApp, type Scope } from "@/lib/store";

const SCOPE_LABEL: Record<Scope, string> = {
  all: "All team leads",
  mine: `My leads (${CURRENT_USER})`,
  unassigned: "Unassigned",
};

const TITLES: Record<string, string> = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.href, i.label])),
);

function useOutsideClose(onClose: () => void) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);
  return ref;
}

function GlobalSearch() {
  const { state } = useApp();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useOutsideClose(() => setOpen(false));

  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus();
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("closer:focus-search", focus);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("closer:focus-search", focus);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const q = query.trim().toLowerCase();
  const pages = NAV.flatMap((g) => g.items)
    .filter((i) => q && i.label.toLowerCase().includes(q))
    .slice(0, 4);
  const leads = q
    ? state.leads
        .filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            l.company.toLowerCase().includes(q) ||
            l.phone.includes(q),
        )
        .slice(0, 5)
    : [];

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  return (
    <div className="search-wrap" ref={boxRef}>
      <div className="search">
        <Icon name="search" size={14} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search"
          aria-label="Search leads and pages"
          suppressHydrationWarning
        />
        <Kbd>/</Kbd>
      </div>
      {open && q ? (
        <div className="search-pop">
          {pages.map((p) => (
            <button key={p.href} className="search-row" onClick={() => go(p.href)}>
              <Icon name={p.icon} size={14} />
              <span>{p.label}</span>
              <span className="search-row-meta">Page</span>
            </button>
          ))}
          {leads.map((l) => (
            <button key={l.id} className="search-row" onClick={() => go("/contacts")}>
              <Icon name="users" size={14} />
              <span>
                {l.name} <span className="search-row-meta">{l.company}</span>
              </span>
              <span className="search-row-meta">{l.code}</span>
            </button>
          ))}
          {!pages.length && !leads.length ? (
            <p className="search-empty">No matches for “{query}”.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { state, toggleSidebar, setTheme, setScope, setLayout, setQuickAdd, setPalette } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const title = TITLES[pathname] ?? "Workspace";
  const isWide = pathname === "/pipeline";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="app">
      <aside
        className="sidebar"
        data-collapsed={state.sidebarCollapsed}
        data-mobile-open={mobileOpen}
        aria-label="Workspace navigation"
      >
        <div className="sidebar-head">
          <Link href="/dashboard" className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                <rect width="24" height="24" rx="6" fill="var(--accent)" />
                <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
                  AI
                </text>
              </svg>
            </span>
            <span className="brand-copy">
              <span className="brand-name">Closer</span>
              <span className="brand-tag">AI Sales CRM</span>
            </span>
          </Link>
          <button
            className="icon-btn sidebar-collapse"
            onClick={toggleSidebar}
            aria-label={state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={state.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name="panel" size={15} />
          </button>
        </div>

        <div className="rail-actions">
          <button
            className="rail-btn"
            onClick={() => setQuickAdd(true)}
            title="Create lead · C"
          >
            <Icon name="pencil" size={14} />
            <span className="nav-item-label">New lead</span>
            <span className="kbd">C</span>
          </button>
          <button
            className="rail-btn only-icon"
            onClick={() => setPalette(true)}
            aria-label="Open command menu"
            title="Command menu · ⌘K"
          >
            <Icon name="search" size={15} />
          </button>
        </div>

        <nav className="sidebar-scroll">
          {NAV.map((group) => (
            <div className="nav-group" key={group.label}>
              <p className="nav-label">{group.label}</p>
              {group.items.map((item) => {
                const current = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="nav-item"
                    aria-current={current ? "page" : undefined}
                    title={state.sidebarCollapsed ? item.label : undefined}
                  >
                    <Icon name={item.icon} size={15} />
                    <span className="nav-item-label">{item.label}</span>
                    {item.href === "/pipeline" ? (
                      <span className="nav-count">{state.leads.length}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <Link href="/settings" className="sidebar-user" title="Account settings">
            <span className="avatar">{CURRENT_USER.slice(0, 2).toUpperCase()}</span>
            <span className="sidebar-user-copy">
              <span className="sidebar-user-name">{CURRENT_USER} Sharma</span>
              <span className="sidebar-user-meta">Owner · Growth</span>
            </span>
            <Icon name="chevron-down" size={13} />
          </Link>
        </div>

        {!state.sidebarCollapsed ? (
          <ResizeHandle
            label="Resize sidebar"
            resetTo={244}
            min={LIMITS.sidebar[0]}
            max={LIMITS.sidebar[1]}
            getWidth={() => state.sidebarWidth}
            setWidth={(sidebarWidth) => setLayout({ sidebarWidth })}
          />
        ) : null}
      </aside>

      <div
        className="scrim"
        data-open={mobileOpen}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      <div className="main">
        <header className="topbar">
          <button
            className="icon-btn mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Icon name="menu" size={18} />
          </button>

          <div className="topbar-lead">
            <span className="breadcrumb">
              Closer <Icon name="chevron-right" size={12} /> <strong>{title}</strong>
            </span>
          </div>

          <div className="topbar-spacer" />

          <GlobalSearch />

          <label className="scope">
            <Icon name="target" size={13} />
            <span>Viewing</span>
            <select
              value={state.scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              aria-label="Data scope"
            >
              {(Object.keys(SCOPE_LABEL) as Scope[]).map((s) => (
                <option key={s} value={s}>
                  {SCOPE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="seg" role="group" aria-label="Colour theme">
            <button
              data-on={state.theme === "light"}
              onClick={() => setTheme("light")}
              aria-pressed={state.theme === "light"}
              title="Light · T"
            >
              <Icon name="sun" size={13} />
              <span className="hide-sm">Light</span>
            </button>
            <button
              data-on={state.theme === "dark"}
              onClick={() => setTheme("dark")}
              aria-pressed={state.theme === "dark"}
              title="Dark · T"
            >
              <Icon name="moon" size={13} />
              <span className="hide-sm">Dark</span>
            </button>
          </div>

          <button
            className="icon-btn"
            onClick={() => setPalette(true)}
            aria-label="Command menu"
            title="Command menu · ⌘K"
          >
            <Icon name="command" size={15} />
          </button>

          <span className="avatar" title={`${CURRENT_USER} Sharma`}>
            {CURRENT_USER.slice(0, 2).toUpperCase()}
          </span>
        </header>

        <main className={isWide ? "page page-wide" : "page"}>{children}</main>
      </div>

      <KeyboardProvider />
    </div>
  );
}

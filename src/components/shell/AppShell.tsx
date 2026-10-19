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
import { WorkspaceLoginDialog } from "@/components/auth/WorkspaceLoginDialog";

const SCOPE_LABEL: Record<string, string> = {
  all: "All team leads",
  mine: `My leads (${CURRENT_USER})`,
  unassigned: "Unassigned (Lead Grab Pool)",
  "agent:Anshita": "Anshita (Senior Closer)",
  "agent:Field Closer Desk": "Field Closer Desk (SIM Relay)",
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
        <Icon name="search" size={16} />
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
  const router = useRouter();
  const { state, toggleSidebar, setTheme, setScope, setLayout, setQuickAdd, setPalette, refreshLeads, logoutWorkspace } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [managerNavMap, setManagerNavMap] = useState<Record<string, boolean> | null>(null);
  const [closerNavMap, setCloserNavMap] = useState<Record<string, boolean>>({
    "/whatsapp": false,
    "/channels": false,
    "/forms": false,
    "/lead-import": false,
  });
  const userMenuRef = useOutsideClose(() => setUserMenuOpen(false));
  const title = TITLES[pathname] ?? "Workspace";
  const isFullBleed = pathname === "/chat";
  const isWide = pathname === "/pipeline";
  const pageClass = isFullBleed ? "page page-full" : isWide ? "page page-wide" : "page";

  const loadNavSettings = () => {
    try {
      const stored = localStorage.getItem("closer.manager.nav.v1");
      if (stored) setManagerNavMap(JSON.parse(stored));
      const storedCloser = localStorage.getItem("closer.closer.nav.v1");
      if (storedCloser) {
        setCloserNavMap(JSON.parse(storedCloser));
      } else {
        const storedTeam = localStorage.getItem("closer.team.v1");
        if (storedTeam) {
          const parsed = JSON.parse(storedTeam);
          if (Array.isArray(parsed.permissions)) {
            const hasWa = parsed.permissions.find((p: any) => p.id === "whatsapp_bulk_marketing")?.closer ?? false;
            const hasPlugins = parsed.permissions.find((p: any) => p.id === "plugins_channels_hub")?.closer ?? false;
            const hasForms = parsed.permissions.find((p: any) => p.id === "forms_builder")?.closer ?? false;
            const hasImport = parsed.permissions.find((p: any) => p.id === "lead_import")?.closer ?? false;
            setCloserNavMap({
              "/whatsapp": hasWa,
              "/channels": hasPlugins,
              "/forms": hasForms,
              "/lead-import": hasImport,
            });
          }
        }
      }
    } catch {}
  };

  useEffect(() => {
    setMobileOpen(false);
    loadNavSettings();

    const handlePermChange = () => loadNavSettings();
    window.addEventListener("aicloser:permissions_updated", handlePermChange);
    window.addEventListener("storage", handlePermChange);
    return () => {
      window.removeEventListener("aicloser:permissions_updated", handlePermChange);
      window.removeEventListener("storage", handlePermChange);
    };
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
            <Icon name="panel" size={17} />
          </button>
        </div>

        <div className="rail-actions">
          <button
            className="rail-btn"
            onClick={() => setQuickAdd(true)}
            title="Create lead · C"
          >
            <Icon name="plus" size={16} />
            <span className="nav-item-label">New lead</span>
            <span className="kbd">C</span>
          </button>
          <button
            className="rail-btn only-icon"
            onClick={() => setPalette(true)}
            aria-label="Open command menu"
            title="Command menu · ⌘K"
          >
            <Icon name="search" size={16} />
          </button>
        </div>

        <nav className="sidebar-scroll">
          {NAV.map((group) => {
            const userRole = state.user?.role || "ADMIN";
            const visibleItems = group.items.filter((item) => {
              if (item.href === "/super-admin") {
                return userRole === "SUPER_ADMIN" || userRole === "ADMIN";
              }
              if (userRole === "ADMIN" || userRole === "SUPER_ADMIN") return true;
              if (userRole === "MANAGER") {
                if (managerNavMap && managerNavMap[item.href] !== undefined) {
                  return managerNavMap[item.href];
                }
                return item.href !== "/automations" && item.href !== "/settings";
              }
              // CLOSER / FIELD USER role:
              // 1. Never see administrative governance or AI developer vaults
              if (item.href === "/team" || item.href === "/automations" || item.href === "/settings") {
                return false;
              }
              // 2. Growth modules are locked by default unless Admin enabled them
              if (item.href === "/whatsapp") {
                return Boolean(closerNavMap["/whatsapp"]);
              }
              if (item.href === "/channels") {
                return Boolean(closerNavMap["/channels"]);
              }
              if (item.href === "/forms") {
                return Boolean(closerNavMap["/forms"]);
              }
              if (item.href === "/lead-import" || item.href === "/import") {
                return Boolean(closerNavMap["/lead-import"]);
              }
              // 3. Core modules are ALWAYS available: Dashboard, Pipeline (leads & grab), Contacts, Calls (listen to recordings), Chat, Payments
              return true;
            });
            if (visibleItems.length === 0) return null;

            return (
              <div className="nav-group" key={group.label}>
                <p className="nav-label">{group.label}</p>
                {visibleItems.map((item) => {
                  const current = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="nav-item"
                      aria-current={current ? "page" : undefined}
                      title={state.sidebarCollapsed ? item.label : undefined}
                    >
                      <Icon name={item.icon} size={17} />
                      <span className="nav-item-label">{item.label}</span>
                      {item.href === "/pipeline" ? (
                        <span className="nav-count">{state.leads.length}</span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        <div className="sidebar-foot" ref={userMenuRef} style={{ position: "relative" }}>
          {userMenuOpen ? (
            <div
              className="user-menu-popover card"
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                left: state.sidebarCollapsed ? "52px" : "8px",
                right: state.sidebarCollapsed ? "auto" : "8px",
                width: state.sidebarCollapsed ? "240px" : "auto",
                background: "var(--bg-elevated, var(--bg-soft))",
                border: "1px solid var(--border-strong, var(--border))",
                boxShadow: "0 10px 28px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)",
                borderRadius: "var(--r-md, 8px)",
                padding: "6px",
                zIndex: 1000,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
              }}
            >
              {/* User Identity Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  borderBottom: "1px solid var(--border)",
                  marginBottom: "4px",
                }}
              >
                <span className="avatar">
                  {(state.user?.displayName || CURRENT_USER).slice(0, 2).toUpperCase()}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: "var(--fs-meta, 13px)",
                      fontWeight: 600,
                      color: "var(--text)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {state.user?.displayName || CURRENT_USER}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--text-tertiary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {state.user?.email || "admin@aicloser.in"}
                  </div>
                </div>
                <span
                  className="chip"
                  data-tone={state.apiConnected ? "success" : "neutral"}
                  style={{ fontSize: "10px", padding: "1px 6px" }}
                >
                  {state.apiConnected ? "Cloud" : "Local"}
                </span>
              </div>

              {/* Menu Actions */}
              <Link
                href="/settings"
                onClick={() => setUserMenuOpen(false)}
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "7px 10px",
                  borderRadius: "var(--r-sm, 6px)",
                  fontSize: "var(--fs-meta, 13px)",
                  color: "var(--text)",
                  textDecoration: "none",
                }}
              >
                <Icon name="settings" size={14} />
                <span>Workspace Settings</span>
              </Link>

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  setPalette(true);
                }}
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "var(--r-sm, 6px)",
                  fontSize: "var(--fs-meta, 13px)",
                  color: "var(--text)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="command" size={14} />
                  <span>Command Palette</span>
                </span>
                <span style={{ fontSize: "10px", color: "var(--text-tertiary)", fontFamily: "var(--mono)" }}>⌘K</span>
              </button>

              <div style={{ height: "1px", background: "var(--border)", margin: "4px 0" }} />

              {/* Logout Option */}
              <button
                type="button"
                onClick={async () => {
                  setUserMenuOpen(false);
                  await logoutWorkspace();
                  router.push("/login");
                }}
                className="user-menu-item-danger"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  padding: "7px 10px",
                  borderRadius: "var(--r-sm, 6px)",
                  fontSize: "var(--fs-meta, 13px)",
                  color: "#ef4444",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  fontWeight: 550,
                }}
              >
                <Icon name="logout" size={14} />
                <span>Log out</span>
              </button>
            </div>
          ) : null}

          {/* User Profile Bar */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              width: "100%",
              gap: "4px",
            }}
          >
            <button
              type="button"
              className="sidebar-user"
              onClick={() => setUserMenuOpen((prev) => !prev)}
              aria-expanded={userMenuOpen}
              title={state.sidebarCollapsed ? `${state.user?.displayName || CURRENT_USER} · Click for menu & logout` : "User menu & options"}
              style={{
                background: userMenuOpen ? "var(--bg-hover)" : undefined,
                border: "none",
                cursor: "pointer",
                font: "inherit",
                color: "inherit",
                outline: "none",
                flex: 1,
                minWidth: 0,
              }}
            >
              <span className="avatar">{(state.user?.displayName || CURRENT_USER).slice(0, 2).toUpperCase()}</span>
              <span className="sidebar-user-copy">
                <span className="sidebar-user-name">{state.user?.displayName || CURRENT_USER}</span>
                <span className="sidebar-user-meta">Owner · Workspace</span>
              </span>
              <Icon
                name="chevron-down"
                size={14}
                style={{
                  transform: userMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              />
            </button>

            {/* Direct Quick Logout Button */}
            {!state.sidebarCollapsed && (
              <button
                type="button"
                onClick={async () => {
                  await logoutWorkspace();
                  router.push("/login");
                }}
                className="icon-btn"
                title="Log out of workspace"
                style={{
                  color: "var(--text-tertiary)",
                  width: "28px",
                  height: "28px",
                  borderRadius: "var(--r-sm)",
                  display: "grid",
                  placeItems: "center",
                  flex: "0 0 auto",
                  cursor: "pointer",
                }}
              >
                <Icon name="logout" size={14} />
              </button>
            )}
          </div>
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
              Closer <Icon name="chevron-right" size={14} /> <strong>{title}</strong>
            </span>
          </div>

          <div className="topbar-spacer" />

          <GlobalSearch />

          <button
            className="btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "7px",
              fontSize: "12px",
              padding: "4px 10px",
              borderRadius: "6px",
              height: "28px",
              background: state.apiConnected ? "rgba(34, 197, 94, 0.12)" : "rgba(255, 255, 255, 0.05)",
              border: `1px solid ${state.apiConnected ? "rgba(34, 197, 94, 0.3)" : "var(--border)"}`,
              color: state.apiConnected ? "#22c55e" : "var(--fg-muted)",
              cursor: "pointer",
            }}
            onClick={() => setLoginModalOpen(true)}
            title={state.apiConnected ? `Connected to live API (${state.user?.displayName || "Cloud"}) · Click to manage` : "Local Demo mode · Click to sign in & load real data"}
          >
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: state.apiConnected ? "#22c55e" : "#eab308",
                display: "inline-block",
              }}
            />
            <span className="hide-sm">
              {state.isLoadingApi ? "Syncing..." : state.apiConnected ? "Live Cloud" : "Local Demo"}
            </span>
          </button>

          <label className="scope">
            <Icon name="target" size={15} />
            <span>Viewing</span>
            <select
              value={state.scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              aria-label="Data scope"
            >
              <option value="all">All team leads</option>
              <option value="mine">My leads ({CURRENT_USER})</option>
              <option value="unassigned">Unassigned (Lead Grab Pool)</option>
              <optgroup label="── Team Closers ──">
                <option value="agent:Anshita">Anshita (Senior Closer)</option>
                <option value="agent:Field Closer Desk">Field Closer Desk (SIM Relay)</option>
              </optgroup>
            </select>
          </label>

          <div className="seg" role="group" aria-label="Colour theme">
            <button
              data-on={state.theme === "light"}
              onClick={() => setTheme("light")}
              aria-pressed={state.theme === "light"}
              title="Light · T"
            >
              <Icon name="sun" size={15} />
              <span className="hide-sm">Light</span>
            </button>
            <button
              data-on={state.theme === "dark"}
              onClick={() => setTheme("dark")}
              aria-pressed={state.theme === "dark"}
              title="Dark · T"
            >
              <Icon name="moon" size={15} />
              <span className="hide-sm">Dark</span>
            </button>
          </div>

          <button
            className="icon-btn"
            onClick={() => setPalette(true)}
            aria-label="Command menu"
            title="Command menu · ⌘K"
          >
            <Icon name="command" size={17} />
          </button>

          <button
            type="button"
            className="avatar"
            onClick={() => setUserMenuOpen((p) => !p)}
            style={{ border: "none", cursor: "pointer", font: "inherit", padding: 0 }}
            title={`${state.user?.displayName || CURRENT_USER} · User menu`}
          >
            {(state.user?.displayName || CURRENT_USER).slice(0, 2).toUpperCase()}
          </button>
        </header>

        <main className={pageClass}>{children}</main>
      </div>

      <KeyboardProvider />
      {loginModalOpen ? <WorkspaceLoginDialog onClose={() => setLoginModalOpen(false)} /> : null}
    </div>
  );
}

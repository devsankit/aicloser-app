"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { ResizeHandle } from "@/components/ui/ResizeHandle";
import { KeyboardProvider } from "@/components/keyboard/KeyboardProvider";
import { Kbd } from "@/components/keyboard/Kbd";
import { NAV } from "@/lib/nav";
import { CURRENT_USER, LIMITS, useApp, useScopedLeads, type Scope } from "@/lib/store";
import { WorkspaceLoginDialog } from "@/components/auth/WorkspaceLoginDialog";
import { aicloserApi } from "@/lib/api-client";

const SCOPE_LABEL: Record<string, string> = {
  all: "All team leads",
  mine: `My leads (${CURRENT_USER})`,
  unassigned: "Unassigned (Lead Grab Pool)",
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [apiLeads, setApiLeads] = useState<any[]>([]);
  const [apiConvs, setApiConvs] = useState<any[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const boxRef = useOutsideClose(() => setOpen(false));
  const searchTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Local navigation pages
  const pages = NAV.flatMap((g) => g.items)
    .filter((i) => q && i.label.toLowerCase().includes(q))
    .slice(0, 4);

  // Live asynchronous Server Database Search across Leads & Conversations
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!q || q.length < 2) {
      setApiLeads([]);
      setApiConvs([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const [leadsRes, convsRes] = await Promise.all([
          aicloserApi.leads.list({ search: q, limit: 6 }).catch(() => ({ leads: [] })),
          aicloserApi.conversations.list({ search: q, limit: 6 }).catch(() => ({ conversations: [] })),
        ]);

        const rawLeads = Array.isArray(leadsRes?.leads) ? leadsRes.leads : [];
        const rawConvs = Array.isArray(convsRes?.conversations)
          ? convsRes.conversations
          : Array.isArray((convsRes as any)?.data)
          ? (convsRes as any).data
          : [];

        setApiLeads(rawLeads);
        setApiConvs(rawConvs);
      } catch {
        // fail gracefully
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [q]);

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
          placeholder="Search leads, chats, pages…"
          aria-label="Search leads and pages"
          suppressHydrationWarning
        />
        <Kbd>/</Kbd>
      </div>
      {open && q ? (
        <div className="search-pop">
          {pages.length > 0 && (
            <>
              <div className="search-section">
                <span>Pages</span>
              </div>
              {pages.map((p) => (
                <button key={p.href} className="search-row" onClick={() => go(p.href)}>
                  <Icon name={p.icon} size={14} />
                  <span>{p.label}</span>
                  <span className="search-row-meta">Page</span>
                </button>
              ))}
            </>
          )}

          {apiLeads.length > 0 && (
            <>
              <div className="search-section">
                <span>Leads & Deals</span>
                <span className="chip" data-size="sm">{apiLeads.length}</span>
              </div>
              {apiLeads.map((l: any) => {
                const leadName = l.customerName || l.name || "Customer";
                const phone = l.customerPhone || l.phone || "";
                const stage = l.stage || "NEW";
                return (
                  <button
                    key={l.id}
                    className="search-row"
                    onClick={() => go(`/pipeline?search=${encodeURIComponent(phone || leadName)}`)}
                  >
                    <Icon name="users" size={14} />
                    <span>
                      {leadName} {phone ? <span className="search-row-meta">{phone}</span> : null}
                    </span>
                    <span className="chip" data-size="sm" data-tone={stage === "CLOSED_WON" ? "success" : stage === "CLOSED_LOST" ? "danger" : "accent"}>
                      {stage}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {apiConvs.length > 0 && (
            <>
              <div className="search-section">
                <span>Conversations</span>
                <span className="chip" data-size="sm">{apiConvs.length}</span>
              </div>
              {apiConvs.map((c: any) => {
                const cName = c.customerName || "Customer";
                const cPhone = c.customerPhone || "";
                return (
                  <button
                    key={c.id}
                    className="search-row"
                    onClick={() => go(`/chat?id=${encodeURIComponent(c.id)}`)}
                  >
                    <Icon name="message-square" size={14} />
                    <span>
                      {cName} {cPhone ? <span className="search-row-meta">{cPhone}</span> : null}
                    </span>
                    <span className="chip" data-size="sm" data-tone="info">
                      {c.serviceSlug || "WhatsApp"}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {isSearching && (
            <p className="search-empty">Searching live database…</p>
          )}

          {!isSearching && !pages.length && !apiLeads.length && !apiConvs.length && (
            <p className="search-empty">No matches found for “{query}”.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, toggleSidebar, setTheme, setScope, setLayout, setQuickAdd, setPalette, refreshLeads, logoutWorkspace, toggleGlobalAiBot } = useApp();
  const scopedLeads = useScopedLeads();
  const isAdmin = state.user?.role === "ADMIN" || state.user?.role === "SUPER_ADMIN" || state.user?.role === "OWNER";
  const isManager = state.user?.role === "MANAGER";
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
  const [workspaceInactive, setWorkspaceInactive] = useState<boolean>(false);
  const [impersonatingName, setImpersonatingName] = useState<string | null>(null);
  const [teamMembers, setTeamMembers] = useState<Array<{ id: string; name: string; count: number }>>([]);

  useEffect(() => {
    let active = true;
    aicloserApi.team.listMembers().then((res: any) => {
      if (!active) return;
      const rawList = Array.isArray(res)
        ? res
        : Array.isArray(res?.members)
        ? res.members
        : Array.isArray(res?.data?.members)
        ? res.data.members
        : [];
      if (rawList.length > 0) {
        const mapped = rawList
          .filter((m: any) => {
            const role = String(m.role || m.workspaceRole || "").toUpperCase();
            return !role.includes("ADMIN");
          })
          .map((m: any) => ({
            id: String(m.id || m.userId),
            name: m.displayName || m.user?.displayName || m.name || "Sales Agent",
            count: Number(m.assignedLeadsCount || m._count?.leadAssignments || 0),
          }));
        setTeamMembers(mapped);
      }
    }).catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const allTeamMembers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();
    for (const tm of teamMembers) {
      map.set(tm.name.toLowerCase(), tm);
    }
    const leadCounts = new Map<string, number>();
    for (const l of state.leads) {
      const o = (l.owner || "").trim();
      const isOwnerOrAdmin =
        o.toLowerCase() === "admin" ||
        o.toLowerCase().includes("admin") ||
        o.toLowerCase() === "ankit rathore" ||
        o.toLowerCase() === (state.user?.displayName || "").toLowerCase();
      if (o && o !== "Unassigned" && !isOwnerOrAdmin) {
        leadCounts.set(o.toLowerCase(), (leadCounts.get(o.toLowerCase()) || 0) + 1);
      }
    }
    for (const [lowerName, count] of leadCounts.entries()) {
      const existing = map.get(lowerName);
      if (existing) {
        existing.count = Math.max(existing.count, count);
      } else {
        const originalLead = state.leads.find((l) => l.owner?.toLowerCase() === lowerName);
        const name = originalLead?.owner || lowerName;
        map.set(lowerName, {
          id: `lead-agent-${lowerName}`,
          name,
          count,
        });
      }
    }
    return Array.from(map.values())
      .filter((m) => {
        const n = m.name.toLowerCase();
        return n !== "admin" && !n.includes("admin") && n !== "ankit rathore" && n !== (state.user?.displayName || "").toLowerCase();
      })
      .sort((a, b) => b.count - a.count);
  }, [teamMembers, state.leads, state.user?.displayName]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setImpersonatingName(window.localStorage.getItem("aicloser_impersonating_name"));
    }
  }, [pathname]);

  useEffect(() => {
    if (pathname.startsWith("/super-admin") || pathname === "/login") {
      setWorkspaceInactive(false);
      return;
    }

    const checkWorkspaceStatus = async () => {
      try {
        const plan: any = await aicloserApi.workspace.getPlan();
        if (plan) {
          const isSuspended =
            plan.isSuspended === true ||
            plan.status === "SUSPENDED" ||
            plan.status === "LOCKED";
          const isExpired =
            plan.expiryDate && new Date(plan.expiryDate).getTime() < Date.now();
          const isInactive =
            isSuspended ||
            Boolean(isExpired) ||
            plan.subscriptionStatus === "INACTIVE" ||
            plan.subscriptionStatus === "EXPIRED" ||
            plan.paymentStatus === "UNPAID";
          setWorkspaceInactive(isInactive);
        }
      } catch {
        // ignore
      }
    };

    void checkWorkspaceStatus();
  }, [pathname]);
  const userMenuRef = useOutsideClose(() => setUserMenuOpen(false));
  const title = TITLES[pathname] ?? "Workspace";
  const isFullBleed = pathname === "/chat";
  const isWide = pathname === "/pipeline";
  const pageClass = isFullBleed ? "page page-full" : isWide ? "page page-wide" : "page";

  const isCloser = (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";

  useEffect(() => {
    if (isCloser && state.scope !== "mine") {
      setScope("mine");
    }
  }, [isCloser, state.scope, setScope]);

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
          <Link href="/dashboard" className="brand" aria-label="AI Closer Dashboard">
            <span className="brand-full-logo-wrap">
              <img
                src="/assets/closer-logo.png"
                alt="AI Closer"
                className="brand-logo-img brand-logo-light"
                height={26}
              />
              <img
                src="/assets/closer-logo-dark.png"
                alt="AI Closer"
                className="brand-logo-img brand-logo-dark"
                height={26}
              />
            </span>
          </Link>
          <button
            type="button"
            className="brand-collapsed-toggle"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <span className="brand-collapsed-icon">
              <img
                src="/assets/closer-icon.png"
                alt="AI Closer"
                width={28}
                height={28}
                className="brand-icon-img"
              />
            </span>
            <span className="brand-collapsed-hover-icon" aria-hidden="true">
              <Icon name="panel" size={17} />
            </span>
          </button>
          <button
            type="button"
            className="icon-btn sidebar-collapse"
            onClick={toggleSidebar}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
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
                return userRole === "SUPER_ADMIN";
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
                        <span className="nav-count">{scopedLeads.length}</span>
                      ) : null}
                    </Link>
                  );
                })}
                {group.label === "CRM & Telephony" && (isAdmin || isManager) && (
                  <Link
                    href="/pipeline?tab=recycle"
                    className="nav-item"
                    title={state.sidebarCollapsed ? "Recycle Bin" : undefined}
                  >
                    <Icon name="trash" size={17} />
                    <span className="nav-item-label">Recycle Bin</span>
                  </Link>
                )}
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
              <a
                href="/latestapk"
                download="aicloser-latest.apk"
                onClick={() => setUserMenuOpen(false)}
                className="user-menu-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  borderRadius: "var(--r-sm, 6px)",
                  fontSize: "var(--fs-meta, 13px)",
                  color: "var(--text)",
                  textDecoration: "none",
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Icon name="phone" size={14} style={{ color: "#22c55e" }} />
                  <span>Download Companion App</span>
                </span>
                <span className="chip" data-tone="success" style={{ fontSize: "9px", padding: "1px 5px", fontWeight: 600 }}>
                  APK
                </span>
              </a>

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

          {/* App Download Option in Sidebar Foot */}
          {!state.sidebarCollapsed ? (
            <a
              href="/latestapk"
              download="aicloser-latest.apk"
              className="sidebar-app-download-btn"
              title="Download AI Closer Companion Android App (.APK)"
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "24px",
                    height: "24px",
                    borderRadius: "6px",
                    background: "rgba(34, 197, 94, 0.15)",
                    color: "#22c55e",
                    flexShrink: 0,
                  }}
                >
                  <Icon name="phone" size={13} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", minWidth: 0, lineHeight: 1.2 }}>
                  <span style={{ fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    Download App
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-tertiary)" }}>
                    Android Companion
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                <span
                  className="chip"
                  data-tone="success"
                  style={{
                    fontSize: "9px",
                    padding: "1px 5px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                  }}
                >
                  APK
                </span>
                <Icon name="download" size={13} style={{ color: "var(--text-secondary)" }} />
              </div>
            </a>
          ) : (
            <a
              href="/latestapk"
              download="aicloser-latest.apk"
              className="sidebar-app-download-btn-collapsed"
              title="Download Android Companion App (.APK)"
            >
              <Icon name="download" size={16} />
            </a>
          )}

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
                <span className="sidebar-user-meta">
                  {state.user?.role === "ADMIN"
                    ? "Admin · Workspace"
                    : (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT"
                    ? "Sales Closer · Workspace"
                    : state.user?.role === "MANAGER"
                    ? "Manager · Workspace"
                    : state.user?.role
                    ? `${state.user.role} · Workspace`
                    : "Owner · Workspace"}
                </span>
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
        {impersonatingName ? (
          <div
            style={{
              background: "var(--accent)",
              color: "#ffffff",
              padding: "6px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "var(--fs-caption)",
              fontWeight: 600,
              zIndex: 50,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="shield" size={14} />
              <span>Super Admin View: Currently managing workspace <u>{impersonatingName}</u></span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: "#ffffff", color: "#111827", height: 24, fontSize: 11, padding: "0 10px", fontWeight: 700 }}
              onClick={async () => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem("aicloser_impersonating_tenant");
                  window.localStorage.removeItem("aicloser_impersonating_name");
                }
                await aicloserApi.superAdmin.returnFromImpersonation().catch(() => null);
                window.location.href = "/super-admin";
              }}
            >
              Exit to Super Admin
            </button>
          </div>
        ) : null}
        {workspaceInactive ? (
          <div className="workspace-inactive-banner" role="alert">
            <Icon name="warning" size={16} />
            <span>⚠️ Your workspace subscription is inactive or expired. Please contact support to activate.</span>
          </div>
        ) : null}
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

          {((state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT") ? (
            <div className="chip" data-tone="accent" title="Closer scope: Viewing your assigned leads only">
              <Icon name="target" size={14} />
              <span>My leads ({state.user?.displayName || CURRENT_USER})</span>
            </div>
          ) : (
            <label className="scope">
              <Icon name="target" size={15} />
              <span>Viewing</span>
              <select
                value={state.scope}
                onChange={(e) => setScope(e.target.value as Scope)}
                aria-label="Data scope"
              >
                <option value="all">All team leads (General Leads)</option>
                <option value="mine">My leads ({state.user?.displayName || CURRENT_USER})</option>
                <option value="unassigned">Unassigned (Lead Grab Pool)</option>
                {allTeamMembers.length > 0 && (
                  <optgroup label="Teammates' Scanned WhatsApp & Leads">
                    {allTeamMembers.map((tm) => (
                      <option key={tm.id} value={`agent:${tm.name}`}>
                        {tm.name} {tm.count > 0 ? `(${tm.count} leads)` : ""}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </label>
          )}

                    {/* Master Global AI Bot Switch */}
          <button
            type="button"
            className="topbar-ai-btn"
            data-active={state.globalAiBotEnabled}
            onClick={() => {
              void toggleGlobalAiBot().catch(() => {});
            }}
            disabled={state.isTogglingAiBot}
            title={
              state.globalAiBotEnabled
                ? "Global AI Sales Bot is ACTIVE across all channels (WhatsApp and Inbound). Click to pause."
                : "Global AI Sales Bot is PAUSED (Manual Human Takeover mode). Click to activate."
            }
            aria-label="Toggle Global AI Bot"
          >
            <span className="dot" />
            <Icon name="bot" size={15} />
            <span className="hide-sm">{state.globalAiBotEnabled ? "AI Bot ON" : "AI Bot OFF"}</span>
          </button>

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

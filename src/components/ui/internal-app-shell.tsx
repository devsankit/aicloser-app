import Link from "next/link";
import { useEffect, useState, type DragEvent as ReactDragEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Bell, Check, Download, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";

import { BrandWordmark } from "@/components/ui/brand-wordmark";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type ShellNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: string;
  group?: "crm" | "growth" | "system" | "workspace" | "beta";
};

type InternalAppShellProps = {
  appLabel: string;
  title: string;
  role?: string;
  homeHref?: string;
  profileName: string;
  profileMeta: string;
  profilePlan?: string;
  hideSidebarIdentity?: boolean;
  navItems: ShellNavItem[];
  activeSection: string;
  onNavigate: (section: string) => void;
  headerPills?: string[];
  sidebarMode?: "default" | "collapsed";
  showTopbar?: boolean;
  showTopbarLabel?: boolean;
  showNotifications?: boolean;
  contentClassName?: string;
  topbarAccessory?: ReactNode;
  topbarCenter?: ReactNode;
  rootClassName?: string;
  navigationOrderKey?: string;
  children: ReactNode;
};

type ShellNotificationItem = {
  body?: string;
  createdAt: string;
  id: string;
  message?: string;
  status: "READ" | "UNREAD" | string;
  title: string;
};

function formatNotificationTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function InternalAppShell({
  appLabel,
  title,
  homeHref = "/",
  profileName,
  profileMeta,
  profilePlan,
  hideSidebarIdentity = false,
  navItems,
  activeSection,
  onNavigate,
  headerPills = [],
  sidebarMode = "default",
  showTopbar = true,
  showTopbarLabel = false,
  showNotifications = false,
  contentClassName,
  topbarAccessory,
  topbarCenter,
  rootClassName,
  navigationOrderKey,
  children,
}: InternalAppShellProps) {
  const [internalSidebarMode, setInternalSidebarMode] = useState<"default" | "collapsed">(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("gx-sidebar-collapsed");
        if (saved === "true") return "collapsed";
      } catch {}
    }
    return sidebarMode === "collapsed" ? "collapsed" : "default";
  });
  const effectiveSidebarMode = internalSidebarMode;
  const navigationStorageKey = `gx-sidebar-order-${navigationOrderKey ?? appLabel}`;
  const [navigationOrder, setNavigationOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(navigationStorageKey);
      return saved ? JSON.parse(saved) as string[] : [];
    } catch {
      return [];
    }
  });
  const [draggedNavId, setDraggedNavId] = useState<string | null>(null);

  useEffect(() => {
    setNavigationOrder((current) => {
      const available = new Set(navItems.map((item) => item.id));
      const retained = current.filter((id) => available.has(id));
      const missing = navItems.map((item) => item.id).filter((id) => !retained.includes(id));
      const next = [...retained, ...missing];
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [navItems]);

  useEffect(() => {
    if (typeof window === "undefined" || !navigationOrder.length) return;
    try {
      localStorage.setItem(navigationStorageKey, JSON.stringify(navigationOrder));
    } catch {}
  }, [navigationOrder, navigationStorageKey]);

  const orderedNavItems = [...navItems].sort((left, right) => {
    const leftIndex = navigationOrder.indexOf(left.id);
    const rightIndex = navigationOrder.indexOf(right.id);
    return (leftIndex < 0 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex < 0 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });

  const moveNavItem = (targetId: string) => {
    if (!draggedNavId || draggedNavId === targetId) return;
    const next = orderedNavItems.map((item) => item.id).filter((id) => id !== draggedNavId);
    const targetIndex = next.indexOf(targetId);
    next.splice(targetIndex < 0 ? next.length : targetIndex, 0, draggedNavId);
    setNavigationOrder(next);
    setDraggedNavId(null);
  };

  const toggleSidebar = () => {
    setInternalSidebarMode((current) => {
      const next = current === "collapsed" ? "default" : "collapsed";
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("gx-sidebar-collapsed", next === "collapsed" ? "true" : "false");
        } catch {}
      }
      return next;
    });
  };

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileMenuMounted, setIsMobileMenuMounted] = useState(false);
  const [isMobileMenuClosing, setIsMobileMenuClosing] = useState(false);
  const [notifications, setNotifications] = useState<ShellNotificationItem[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [markingReadIds, setMarkingReadIds] = useState<Set<string>>(() => new Set());
  const [notificationError, setNotificationError] = useState("");
  const isChatContent = (contentClassName?.includes("internal-content-chat") || contentClassName?.includes("manager-chat-page-shell")) ?? false;
  const initials = profileName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    if (!isMobileMenuClosing) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIsMobileMenuMounted(false);
      setIsMobileMenuClosing(false);
    }, 220);

    return () => window.clearTimeout(timer);
  }, [isMobileMenuClosing]);

  useEffect(() => {
    if (!showNotifications) {
      return undefined;
    }

    let isActive = true;
    const controller = new AbortController();

    const fetchNotifications = async () => {
      try {
        const response = await fetch("/api/notifications", { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as { notifications?: ShellNotificationItem[] };
        if (isActive) {
          setNotifications(payload.notifications ?? []);
        }
      } catch {
        return;
      }
    };

    void fetchNotifications();
    const interval = window.setInterval(() => {
      void fetchNotifications();
    }, 30_000);

    return () => {
      isActive = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [showNotifications]);

  const openMobileMenu = () => {
    setIsMobileMenuMounted(true);
    setIsMobileMenuClosing(false);
    setIsMobileMenuOpen(true);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
    setIsMobileMenuClosing(true);
  };

  const toggleMobileMenu = () => {
    if (isMobileMenuOpen && !isMobileMenuClosing) {
      closeMobileMenu();
      return;
    }

    openMobileMenu();
  };

  const renderNavItem = (item: ShellNavItem, keyPrefix = "nav", closeAfterNavigate = false) => {
    const Icon = item.icon;
    const isCollapsed = effectiveSidebarMode === "collapsed";
    const content = (
      <>
        <Icon className="internal-nav-icon" size={18} strokeWidth={1.8} />
        {isCollapsed ? null : (
          <>
            <span className="internal-nav-label">
              {item.label}
            </span>
            {item.badge ? (
              <span className="internal-nav-badge">
                {item.badge}
              </span>
            ) : null}
          </>
        )}
      </>
    );
    const dragProps = {
      draggable: true,
      onDragStart: () => setDraggedNavId(item.id),
      onDragOver: (event: ReactDragEvent<HTMLElement>) => event.preventDefault(),
      onDrop: (event: ReactDragEvent<HTMLElement>) => {
        event.preventDefault();
        moveNavItem(item.id);
      },
      onDragEnd: () => setDraggedNavId(null),
    };

    if (item.href) {
      return (
        <Link
          className={activeSection === item.id ? "sidebar-nav-item internal-nav-item active" : "sidebar-nav-item internal-nav-item"}
          href={item.href}
          key={`${keyPrefix}-${item.id}`}
          {...dragProps}
          onClick={closeAfterNavigate ? () => closeMobileMenu() : undefined}
          title={effectiveSidebarMode === "collapsed" ? item.label : undefined}
        >
          {content}
        </Link>
      );
    }

    return (
      <button
        className={activeSection === item.id ? "sidebar-nav-item internal-nav-item active" : "sidebar-nav-item internal-nav-item"}
        key={`${keyPrefix}-${item.id}`}
        {...dragProps}
        onClick={() => {
          onNavigate(item.id);
          if (closeAfterNavigate) {
            closeMobileMenu();
          }
        }}
        title={effectiveSidebarMode === "collapsed" ? item.label : undefined}
        type="button"
      >
        {content}
      </button>
    );
  };

  const dashboardHomeHref = navItems.find((item) => item.href)?.href ?? homeHref;
  const unreadCount = notifications.filter((notification) => notification.status === "UNREAD").length;

  const markNotificationRead = async (notificationId: string) => {
    setNotificationError("");
    setMarkingReadIds((current) => new Set(current).add(notificationId));

    try {
      const response = await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, { method: "POST" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setNotificationError(payload?.error ?? "Could not mark this notification as read. Please try again.");
        return;
      }
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === notificationId
            ? {
                ...notification,
                status: "READ",
              }
            : notification,
        ),
      );
    } catch {
      setNotificationError("Could not mark this notification as read. Check your connection and try again.");
    } finally {
      setMarkingReadIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
    }
  };

  const markAllNotificationsRead = async () => {
    const unreadIds = notifications.filter((notification) => notification.status === "UNREAD").map((notification) => notification.id);
    await Promise.all(unreadIds.map((notificationId) => markNotificationRead(notificationId)));
  };

  return (
    <main className={`app-shell internal-theme-root${rootClassName ? ` ${rootClassName}` : ""}`}>
      <div className={effectiveSidebarMode === "collapsed" ? "workspace-shell internal-shell internal-shell-collapsed" : "workspace-shell internal-shell"}>
        <aside className={effectiveSidebarMode === "collapsed" ? "workspace-sidebar internal-sidebar internal-sidebar-collapsed" : "workspace-sidebar internal-sidebar"}>
          <BrandWordmark ariaLabel="Go to dashboard home" className="sidebar-brand internal-brand-block" href={dashboardHomeHref} collapsed={effectiveSidebarMode === "collapsed"} />

          <button
            type="button"
            onClick={toggleSidebar}
            className={`topbar-link internal-home-link internal-sidebar-collapse-toggle freelancer-back${effectiveSidebarMode === "collapsed" ? " is-collapsed" : ""}`}
            title={effectiveSidebarMode === "collapsed" ? "Expand sidebar" : "Minimize sidebar"}
            aria-label={effectiveSidebarMode === "collapsed" ? "Expand sidebar" : "Minimize sidebar"}
          >
            {effectiveSidebarMode === "collapsed" ? (
              <PanelLeftOpen size={17} strokeWidth={1.8} />
            ) : (
              <>
                <PanelLeftClose size={16} strokeWidth={1.8} />
                <span>Minimize sidebar</span>
              </>
            )}
          </button>
          <nav aria-label={`${appLabel} navigation`} className="sidebar-nav secondary internal-nav">
            {(
              [
                { key: "crm", title: "CRM & Telephony", items: orderedNavItems.filter((i) => i.group === "crm") },
                { key: "growth", title: "Growth & Automation", items: orderedNavItems.filter((i) => i.group === "growth") },
                { key: "system", title: "Analytics & Settings", items: orderedNavItems.filter((i) => i.group === "system") },
                { key: "workspace", title: "Workspace", items: orderedNavItems.filter((i) => !i.group || i.group === "workspace") },
                { key: "beta", title: "Beta Intelligence", items: orderedNavItems.filter((i) => i.group === "beta") },
              ] as const
            )
              .filter((section) => section.items.length > 0)
              .map((section, idx) => (
                <div className={`sidebar-nav-section${idx > 0 ? " is-spaced" : ""}`} key={section.key}>
                  {effectiveSidebarMode !== "collapsed" ? (
                    <p className="sidebar-nav-label">{section.title}</p>
                  ) : null}
                  {section.items.map((item) => renderNavItem(item))}
                </div>
              ))}
          </nav>

          <div className="internal-sidebar-footer">
            <div className="internal-sidebar-account-controls">
              {hideSidebarIdentity ? null : (
                <Link
                  aria-label={`Open ${profileName} profile`}
                  className="internal-sidebar-profile"
                  href={dashboardHomeHref}
                  title={`${profileName}${profileMeta ? ` · ${profileMeta}` : ""}`}
                >
                  <div className="internal-avatar">{initials}</div>
                  {effectiveSidebarMode !== "collapsed" ? (
                    <div className="internal-sidebar-profile-copy">
                      <strong>{profileName}</strong>
                      <span>{profilePlan ? `Active plan · ${profilePlan}` : profileMeta}</span>
                    </div>
                  ) : null}
                </Link>
              )}
              <div className="internal-sidebar-quick-actions">
                <a
                  aria-label="Download AIcloser mobile app"
                  className="internal-sidebar-download"
                  href="https://aicloser.in/download/AICloser.apk"
                  rel="noreferrer"
                  target="_blank"
                  title="Download AIcloser mobile app"
                >
                  <Download size={15} strokeWidth={1.9} />
                  {effectiveSidebarMode !== "collapsed" ? <span>Download App</span> : null}
                </a>
                <a
                  aria-label="Sign out"
                  className="freelancer-secondary-button internal-signout-button"
                  href="/api/auth/logout"
                  title="Sign out"
                >
                  <LogOut size={15} strokeWidth={1.8} />
                </a>
              </div>
            </div>
          </div>
        </aside>

        <section className={isChatContent ? "workspace-main internal-main internal-main-chat" : "workspace-main internal-main"}>
          {showTopbar ? (
            <header className="workspace-topbar internal-topbar">
              <div className="internal-topbar-main-row">
                <div className="internal-topbar-heading">
                  <BrandWordmark ariaLabel="Go to dashboard home" className="topbar-brand internal-mobile-topbar-brand" href={dashboardHomeHref} />
                  <div className="internal-topbar-heading-copy">
                    {showTopbarLabel ? <p className="topbar-label">{appLabel}</p> : null}
                    <h1 className="app-page-title">{title}</h1>
                  </div>
                </div>

                <div className="internal-topbar-right">
                  {headerPills.length ? (
                    <div className="topbar-actions internal-topbar-pills internal-desktop-pills">
                      {headerPills.map((pill) => (
                        <span className="topbar-pill" key={pill}>
                          {pill}
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className="internal-topbar-desktop-actions">
                    {topbarCenter ? (
                      <div className="internal-topbar-desktop-slot" style={{ display: "inline-flex", alignItems: "center" }}>
                        {topbarCenter}
                      </div>
                    ) : null}
                    {topbarAccessory}
                    <ThemeToggle />
                    {showNotifications ? (
                      <div className="internal-notification-wrap">
                        <button
                          aria-expanded={isNotificationsOpen}
                          aria-label={isNotificationsOpen ? "Close notifications" : "Open notifications"}
                          className="internal-notification-button"
                          onClick={() => {
                            setNotificationError("");
                            setIsNotificationsOpen((open) => !open);
                          }}
                          type="button"
                        >
                          <Bell size={16} strokeWidth={1.9} />
                          {unreadCount ? <span className="internal-notification-dot">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
                        </button>
                        {isNotificationsOpen ? (
                          <aside aria-label="Notifications" className="internal-notification-popover">
                            <header>
                              <div>
                                <strong>Notifications</strong>
                                <span>{unreadCount ? `${unreadCount} unread` : "You're all caught up"}</span>
                              </div>
                              {unreadCount ? (
                                <button
                                  className="internal-notification-mark-all"
                                  disabled={markingReadIds.size > 0}
                                  onClick={() => void markAllNotificationsRead()}
                                  type="button"
                                >
                                  Mark all read
                                </button>
                              ) : null}
                            </header>
                            {notificationError ? (
                              <p className="internal-notification-error" role="alert">
                                {notificationError}
                              </p>
                            ) : null}
                            <div className="internal-notification-list">
                              {notifications.map((notification) => {
                                const isUnread = notification.status === "UNREAD";
                                const isMarkingRead = markingReadIds.has(notification.id);
                                const formattedTime = formatNotificationTime(notification.createdAt);

                                return (
                                  <article
                                    className={isUnread ? "internal-notification-item is-unread" : "internal-notification-item"}
                                    key={notification.id}
                                  >
                                    <span aria-hidden="true" className="internal-notification-status-dot" />
                                    <div className="internal-notification-copy">
                                      <strong>{notification.title}</strong>
                                      <p>{notification.message ?? notification.body}</p>
                                      <div className="internal-notification-meta">
                                        {formattedTime ? <time dateTime={notification.createdAt}>{formattedTime}</time> : null}
                                        {!isUnread ? <span className="internal-notification-read">Read</span> : null}
                                      </div>
                                    </div>
                                    {isUnread ? (
                                      <button
                                        disabled={isMarkingRead}
                                        onClick={() => void markNotificationRead(notification.id)}
                                        type="button"
                                      >
                                        <Check size={14} strokeWidth={2.2} />
                                        {isMarkingRead ? "Marking..." : "Mark read"}
                                      </button>
                                    ) : null}
                                  </article>
                                );
                              })}
                              {!notifications.length ? <p className="internal-notification-empty">No notifications yet.</p> : null}
                            </div>
                          </aside>
                        ) : null}
                      </div>
                    ) : null}

                  </div>

                  <div className="internal-mobile-topbar-actions">
                    {topbarCenter ? (
                      <div className="internal-mobile-topbar-center internal-tablet-ai-slot" style={{ display: "inline-flex", alignItems: "center", marginRight: "4px" }}>
                        {topbarCenter}
                      </div>
                    ) : null}
                    {topbarAccessory}
                    <ThemeToggle />
                    <div className="internal-avatar internal-mobile-avatar">{initials}</div>
                    <button
                      aria-label={isMobileMenuOpen ? "Close dashboard menu" : "Open dashboard menu"}
                      className="internal-mobile-menu-button"
                      onClick={toggleMobileMenu}
                      type="button"
                    >
                      {isMobileMenuOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
                    </button>
                  </div>
                </div>
              </div>

              {headerPills.length ? (
                <div className="internal-topbar-pills-row">
                  {headerPills.map((pill) => (
                    <span className="topbar-pill" key={pill}>
                      {pill}
                    </span>
                  ))}
                </div>
              ) : null}
            </header>
          ) : null}

          <div className={isChatContent ? "public-shell-canvas internal-canvas internal-canvas-chat" : "public-shell-canvas internal-canvas"}>
            <div className={contentClassName ? `internal-content app-shell-content ${contentClassName}` : "internal-content app-shell-content"}>{children}</div>
          </div>
        </section>
      </div>

      {isMobileMenuMounted ? (
        <div className={`internal-mobile-drawer-backdrop${isMobileMenuClosing ? " is-closing" : " is-open"}`}>
          <button aria-label="Close dashboard menu" className="internal-mobile-drawer-scrim" onClick={closeMobileMenu} type="button" />
          <aside className={`internal-mobile-drawer${isMobileMenuClosing ? " is-closing" : " is-open"}`}>
            <div className="internal-mobile-drawer-head">
              <BrandWordmark ariaLabel="Go to dashboard home" href={dashboardHomeHref} onClick={closeMobileMenu} />
              <button
                aria-label="Close dashboard menu"
                className="internal-mobile-menu-button"
                onClick={closeMobileMenu}
                type="button"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            <Link className="topbar-link internal-home-link freelancer-back internal-mobile-home-link" href={homeHref} onClick={closeMobileMenu}>
              <ArrowLeft size={14} strokeWidth={1.8} />
              Back to home
            </Link>

            <Link className="internal-profile-card internal-mobile-drawer-profile" href={dashboardHomeHref} onClick={closeMobileMenu}>
              <div className="internal-avatar">{initials}</div>
              <div>
                <strong>{profileName}</strong>
                <span>Open dashboard</span>
              </div>
            </Link>

            <nav aria-label={`${appLabel} navigation`} className="sidebar-nav secondary internal-nav internal-mobile-nav">
              {(
                [
                  { key: "crm", title: "CRM & Telephony", items: orderedNavItems.filter((i) => i.group === "crm") },
                  { key: "growth", title: "Growth & Automation", items: orderedNavItems.filter((i) => i.group === "growth") },
                  { key: "system", title: "Analytics & Settings", items: orderedNavItems.filter((i) => i.group === "system") },
                  { key: "workspace", title: "Workspace", items: orderedNavItems.filter((i) => !i.group || i.group === "workspace") },
                  { key: "beta", title: "Beta Intelligence", items: orderedNavItems.filter((i) => i.group === "beta") },
                ] as const
              )
                .filter((section) => section.items.length > 0)
                .map((section, idx) => (
                  <div className={`sidebar-nav-section${idx > 0 ? " is-spaced" : ""}`} key={`drawer-${section.key}`}>
                    <p className="sidebar-nav-label">{section.title}</p>
                    {section.items.map((item) => renderNavItem(item, "drawer", true))}
                  </div>
                ))}
            </nav>

            <a className="freelancer-secondary-button internal-signout-button internal-mobile-drawer-signout" href="/api/auth/logout">
              Sign out
            </a>
          </aside>
        </div>
      ) : null}
    </main>
  );
}

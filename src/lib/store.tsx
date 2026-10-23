"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Density, FontScale, Lead, LeadPoolItem, NavSpacing, Priority, Segment, StageId, Theme } from "./types";
import { STAGES, normalizeSource } from "./types";
import { aicloserApi, type UserSession } from "./api-client";
import { backendLeadToUiLead, uiLeadToBackendPayload, stageIdToBackendStage, isTeammateScannedWhatsAppLead } from "./lead-mapper";

const KEY = "closer.ui.v2";

export type Scope = "all" | "mine" | "unassigned" | `agent:${string}`;

interface Persisted {
  leads: Lead[];
  theme: Theme;
  density: Density;
  /** Accent colour as a hex string. */
  accent: string;
  /** Base type scale. */
  fontScale: FontScale;
  /** Sidebar menu item vertical spacing in px. */
  navSpacing: NavSpacing;
  sidebarWidth: number;
  colWidth: number;
  drawerWidth: number;
}

export interface PoolQuotaInfo {
  initialStageCount: number | null;
  grabCapacity: number | null;
  availableSlots: number | null;
  isAtQuota: boolean | null;
  initialStageLabel: string;
}

interface AppState extends Persisted {
  sidebarCollapsed: boolean;
  scope: Scope;
  hydrated: boolean;
  /** Global overlay state, driven by the keyboard layer. */
  paletteOpen: boolean;
  sheetOpen: boolean;
  quickAddOpen: boolean;
  /** Live API sync status */
  apiConnected: boolean;
  isLiveCloud: boolean;
  isLoadingApi: boolean;
  user: UserSession | null;
  workspaceAuth: { user: UserSession | null } | null;
  /** Open lead grab pool from Google Sheets, WhatsApp, etc. */
  poolLeads: LeadPoolItem[];
  poolCount: number;
  isPoolLoading: boolean;
  poolQuota: PoolQuotaInfo | null;
  /** Global AI Bot master toggle across all channels */
  globalAiBotEnabled: boolean;
  isTogglingAiBot: boolean;
  /** Active workspace team members */
  teamMembers: Array<{ id: string; name: string; role?: string; displayName?: string }>;
}

interface AppApi {
  state: AppState;
  toggleGlobalAiBot: () => Promise<boolean>;
  setGlobalAiBotEnabled: (enabled: boolean) => void;
  moveLead: (id: string, stage: StageId, targetLeadId?: string) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  addLead: (lead: Omit<Lead, "id" | "updatedAt" | "code">) => Promise<Lead>;
  deleteLead: (id: string) => Promise<void> | void;
  claimLead: (id: string, closerName?: string) => void;
  claimFromPool: (
    poolItemId: string,
    closerName?: string,
    assignedAgentId?: string
  ) => Promise<{ success: boolean; message?: string; lead?: Lead }>;
  autoDistributePool: () => Promise<any>;
  fetchPoolLeads: (params?: { maxVisibleToCloser?: number }) => Promise<LeadPoolItem[]>;
  reassignLead: (id: string, newOwner: string, note?: string) => void;
  refreshLeads: () => Promise<void>;
  loginWorkspace: (
    identifierOrCreds: string | { email?: string; identifier?: string; password?: string; token?: string },
    password?: string
  ) => Promise<{ success: boolean; error?: string }>;
  signupWorkspace: (params: {
    companyName: string;
    adminName: string;
    email: string;
    phone: string;
    password: string;
    teamSize?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logoutWorkspace: () => Promise<void>;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setAccent: (accent: string) => void;
  setFontScale: (scale: FontScale) => void;
  setNavSpacing: (spacing: NavSpacing) => void;
  toggleSidebar: () => void;
  setScope: (scope: Scope) => void;
  setLayout: (patch: Partial<Pick<Persisted, "sidebarWidth" | "colWidth" | "drawerWidth">>) => void;
  setPalette: (open: boolean) => void;
  setSheet: (open: boolean) => void;
  setQuickAdd: (open: boolean) => void;
  reset: () => void;
}

const AppContext = createContext<AppApi | null>(null);

export const CURRENT_USER = "Admin";

/** Resizable limits, in px. */
export const LIMITS = {
  sidebar: [200, 400] as const,
  col: [208, 420] as const,
  drawer: [360, 760] as const,
};

/** The orange lifted straight from the Closer logo. */
export const BRAND_ACCENT = "#f4612a";

export interface AccentPreset {
  id: string;
  label: string;
  color: string;
}

/** Curated accent choices offered in Settings. */
export const ACCENTS: AccentPreset[] = [
  { id: "brand", label: "Closer Orange", color: BRAND_ACCENT },
  { id: "indigo", label: "Indigo", color: "#5e6ad2" },
  { id: "violet", label: "Violet", color: "#8b5cf6" },
  { id: "blue", label: "Blue", color: "#3b82f6" },
  { id: "teal", label: "Teal", color: "#14b8a6" },
  { id: "green", label: "Green", color: "#22a06b" },
  { id: "rose", label: "Rose", color: "#e5484d" },
];

export const FONT_SCALES: { id: FontScale; label: string; factor: number }[] = [
  { id: "sm", label: "Small", factor: 0.92 },
  { id: "md", label: "Default", factor: 1 },
  { id: "lg", label: "Large", factor: 1.1 },
  { id: "xl", label: "Larger", factor: 1.22 },
];

const FONT_TOKENS: Record<string, number> = {
  caption: 12,
  meta: 13,
  body: 14,
  title: 16,
  page: 19,
  metric: 24,
};

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = HEX.exec(hex.trim());
  if (!match) return null;
  const raw = match[1].length === 3 ? match[1].split("").map((c) => c + c).join("") : match[1];
  const n = parseInt(raw, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

const toHex = (c: { r: number; g: number; b: number }) =>
  `#${[c.r, c.g, c.b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;

/** Relative luminance, per WCAG 2.x. */
const channelLuminance = (value: number) => {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = ({ r, g, b }: { r: number; g: number; b: number }) =>
  0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);

/** Contrast ratio of a colour against white. */
const whiteContrast = (c: { r: number; g: number; b: number }) => 1.05 / (luminance(c) + 0.05);

/** Contrast ratio between two opaque colours. */
const contrastRatio = (a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }) => {
  const l1 = luminance(a);
  const l2 = luminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
};

/** Composite a colour at `alpha` over an opaque backdrop. */
const over = (
  c: { r: number; g: number; b: number },
  bg: { r: number; g: number; b: number },
  alpha: number,
) => ({
  r: bg.r * (1 - alpha) + c.r * alpha,
  g: bg.g * (1 - alpha) + c.g * alpha,
  b: bg.b * (1 - alpha) + c.b * alpha,
});

const DARK_SURFACE = { r: 15, g: 16, b: 17 };

/**
 * Lift a colour toward white until it reads as *text* on dark surfaces,
 * including its own soft tint. Keeps accent labels at AA for every preset.
 */
function liftForDark(hex: string, target = 4.8) {
  const start = parseHex(hex) ?? { r: 244, g: 97, b: 42 };
  let rgb = start;
  for (let amount = 0; amount <= 0.9; amount += 0.02) {
    rgb = {
      r: start.r + (255 - start.r) * amount,
      g: start.g + (255 - start.g) * amount,
      b: start.b + (255 - start.b) * amount,
    };
    if (contrastRatio(rgb, over(rgb, DARK_SURFACE, 0.18)) >= target) break;
  }
  return toHex(rgb);
}

const LIGHT_SURFACE = { r: 255, g: 255, b: 255 };

/**
 * Darken further until a colour reads as *text* on light surfaces, including
 * its own soft tint. Light counterpart of `liftForDark`.
 */
function darkenForLight(hex: string, target = 4.9) {
  const start = parseHex(hex) ?? { r: 244, g: 97, b: 42 };
  let rgb = start;
  for (let amount = 0; amount <= 0.9; amount += 0.02) {
    rgb = { r: start.r * (1 - amount), g: start.g * (1 - amount), b: start.b * (1 - amount) };
    if (contrastRatio(rgb, over(rgb, LIGHT_SURFACE, 0.12)) >= target) break;
  }
  return toHex(rgb);
}

/**
 * Darken a colour toward black until white text on top clears `target`.
 * Keeps solid accent fills at AA contrast for every preset.
 */
function darkenForWhite(hex: string, target = 4.7) {
  const start = parseHex(hex) ?? { r: 244, g: 97, b: 42 };
  let rgb = start;
  for (let amount = 0; amount <= 0.92; amount += 0.04) {
    rgb = { r: start.r * (1 - amount), g: start.g * (1 - amount), b: start.b * (1 - amount) };
    if (whiteContrast(rgb) >= target) break;
  }
  return toHex(rgb);
}

/** Blend a hex colour toward black (target 0) or white (target 255). */
const blend = (hex: string, target: number, amount: number) => {
  const rgb = parseHex(hex) ?? { r: 244, g: 97, b: 42 };
  return toHex({
    r: rgb.r + (target - rgb.r) * amount,
    g: rgb.g + (target - rgb.g) * amount,
    b: rgb.b + (target - rgb.b) * amount,
  });
};

const rgba = (hex: string, alpha: number) => {
  const rgb = parseHex(hex) ?? { r: 244, g: 97, b: 42 };
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
};

/**
 * Derive the full accent token set. On light surfaces the base is darkened so
 * accent-coloured text keeps AA contrast against white; `strong` is the fill
 * used behind white text.
 */
export function accentTokens(accent: string, theme: Theme) {
  const light = theme === "light";
  const base = light ? darkenForLight(blend(accent, 0, 0.3)) : liftForDark(accent);
  const strong = darkenForWhite(base);
  return {
    base,
    hover: light ? blend(base, 0, 0.12) : blend(base, 255, 0.16),
    strong,
    // Always a shade darker than `strong`, so hover reads on both themes.
    strongHover: blend(strong, 0, 0.09),
    soft: rgba(base, light ? 0.12 : 0.18),
    border: rgba(base, light ? 0.38 : 0.45),
    selected: rgba(base, light ? 0.12 : 0.16),
    infoSoft: rgba(base, light ? 0.1 : 0.15),
  };
}

/** Scale the type tokens for a chosen base size. */
export function fontTokens(scale: FontScale): Record<string, string> {
  const factor = FONT_SCALES.find((s) => s.id === scale)?.factor ?? 1;
  return Object.fromEntries(
    Object.entries(FONT_TOKENS).map(([name, size]) => [name, `${Math.round(size * factor)}px`]),
  );
}

/** Apply accent + type scale + nav item spacing to the document root. Safe to call pre-hydration. */
export function applyAppearance(accent: string, fontScale: FontScale, theme: Theme, navSpacing: NavSpacing = 2) {
  const root = document.documentElement;
  const tokens = accentTokens(accent, theme);
  root.style.setProperty("--accent", tokens.base);
  root.style.setProperty("--accent-hover", tokens.hover);
  root.style.setProperty("--accent-strong", tokens.strong);
  root.style.setProperty("--accent-strong-hover", tokens.strongHover);
  root.style.setProperty("--accent-soft", tokens.soft);
  root.style.setProperty("--accent-border", tokens.border);
  root.style.setProperty("--bg-selected", tokens.selected);
  root.style.setProperty("--info", tokens.base);
  root.style.setProperty("--info-soft", tokens.infoSoft);
  root.style.setProperty("--nav-item-gap", `${navSpacing}px`);
  const fonts = fontTokens(fontScale);
  for (const [name, value] of Object.entries(fonts)) {
    root.style.setProperty(`--fs-${name}`, value);
  }
}

const normalizeAccent = (value: unknown): string =>
  typeof value === "string" && HEX.test(value.trim()) ? value.trim() : BRAND_ACCENT;

const normalizeFontScale = (value: unknown): FontScale =>
  value === "sm" || value === "lg" || value === "xl" ? value : "md";

const normalizeNavSpacing = (value: unknown): NavSpacing =>
  value === 1 || value === 2 || value === 4 || value === 6 ? (value as NavSpacing) : 2;

const initialState: AppState = {
  leads: [],
  theme: "light",
  density: "comfortable",
  accent: BRAND_ACCENT,
  fontScale: "md",
  navSpacing: 2,
  sidebarWidth: 244,
  colWidth: 288,
  drawerWidth: 460,
  sidebarCollapsed: false,
  scope: "all",
  hydrated: false,
  paletteOpen: false,
  sheetOpen: false,
  quickAddOpen: false,
  apiConnected: false,
  isLiveCloud: false,
  isLoadingApi: false,
  user: null,
  workspaceAuth: null,
  poolLeads: [],
  poolCount: 0,
  isPoolLoading: false,
  poolQuota: null,
  globalAiBotEnabled: true,
  isTogglingAiBot: false,
  teamMembers: [],
};

const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, Math.round(value)));

function readStorage(): Partial<Persisted> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    // IMPORTANT: Never load cached leads from localStorage! Leads must strictly load from the tenant's live database.
    delete parsed.leads;
    return parsed;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authToken = params.get("auth_token") || params.get("token");
      if (authToken) {
        window.localStorage.setItem("aicloser_auth_token", authToken);
        window.localStorage.setItem("aicloser_token", authToken);
        document.cookie = `aicloser_token=${encodeURIComponent(authToken)}; path=/; max-age=2592000; SameSite=Lax`;
        const cleanUrl = new URL(window.location.href);
        cleanUrl.searchParams.delete("auth_token");
        cleanUrl.searchParams.delete("token");
        window.history.replaceState({}, "", cleanUrl.toString());
      }
    }
    const saved = readStorage();
    setState((prev) => ({
      ...prev,
      hydrated: true,
      leads: saved?.leads?.length ? saved.leads : prev.leads,
      theme: saved?.theme === "dark" || saved?.theme === "light" ? saved.theme : "light",
      density: saved?.density === "compact" ? "compact" : "comfortable",
      accent: normalizeAccent(saved?.accent),
      fontScale: normalizeFontScale(saved?.fontScale),
      navSpacing: normalizeNavSpacing(saved?.navSpacing),
      sidebarWidth: saved?.sidebarWidth ? clamp(saved.sidebarWidth, LIMITS.sidebar) : prev.sidebarWidth,
      colWidth: saved?.colWidth ? clamp(saved.colWidth, LIMITS.col) : prev.colWidth,
      drawerWidth: saved?.drawerWidth
        ? clamp(saved.drawerWidth, LIMITS.drawer)
        : prev.drawerWidth,
    }));
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = state.theme;
    root.dataset.density = state.density;
    root.style.setProperty("--sidebar-w", `${state.sidebarWidth}px`);
    root.style.setProperty("--col-w", `${state.colWidth}px`);
    root.style.setProperty("--drawer-w", `${state.drawerWidth}px`);
    applyAppearance(state.accent, state.fontScale, state.theme, state.navSpacing);
  }, [
    state.theme,
    state.density,
    state.accent,
    state.fontScale,
    state.navSpacing,
    state.sidebarWidth,
    state.colWidth,
    state.drawerWidth,
  ]);

  useEffect(() => {
    if (!state.hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const payload: Persisted = {
          leads: state.leads,
          theme: state.theme,
          density: state.density,
          accent: state.accent,
          fontScale: state.fontScale,
          navSpacing: state.navSpacing,
          sidebarWidth: state.sidebarWidth,
          colWidth: state.colWidth,
          drawerWidth: state.drawerWidth,
        };
        window.localStorage.setItem(KEY, JSON.stringify(payload));
      } catch {
        /* storage blocked — keep working in memory */
      }
    }, 200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [
    state.leads,
    state.theme,
    state.density,
    state.accent,
    state.fontScale,
    state.navSpacing,
    state.sidebarWidth,
    state.colWidth,
    state.drawerWidth,
    state.hydrated,
  ]);

  const refreshLeads = useCallback(async () => {
    try {
      setState((p) => ({ ...p, isLoadingApi: true }));
      let me = await aicloserApi.auth.me().catch(() => null);

      // Fallback hydration from session cookies if me() fails or is slow
      if (!me?.user && typeof document !== "undefined") {
        const cookies = document.cookie;
        const tenantIdMatch = cookies.match(/(?:^|;\s*)gx_tenant=([^;]+)/)?.[1];
        const roleMatch = cookies.match(/(?:^|;\s*)gx_role=([^;]+)/)?.[1];
        const nameMatch = cookies.match(/(?:^|;\s*)gx_user_name=([^;]+)/)?.[1];
        const emailMatch = cookies.match(/(?:^|;\s*)gx_user_email=([^;]+)/)?.[1];
        const impNameMatch = cookies.match(/(?:^|;\s*)gx_impersonating_name=([^;]+)/)?.[1];
        if (roleMatch || tenantIdMatch || impNameMatch) {
          me = {
            user: {
              userId: "session-user",
              displayName: nameMatch ? decodeURIComponent(nameMatch) : (impNameMatch ? `${decodeURIComponent(impNameMatch)} Admin` : "Workspace Admin"),
              email: emailMatch ? decodeURIComponent(emailMatch) : "",
              role: ((roleMatch ? decodeURIComponent(roleMatch) : "SALES_AGENT") as any),
              tenantId: tenantIdMatch ? decodeURIComponent(tenantIdMatch) : "workspace",
            },
            tenant: {
              id: tenantIdMatch ? decodeURIComponent(tenantIdMatch) : "workspace",
              name: impNameMatch ? decodeURIComponent(impNameMatch) : "Workspace",
            },
          } as any;
        }
      }

      if (me?.user) {
        if (me.user.role !== "SUPER_ADMIN" && typeof window !== "undefined") {
          window.localStorage.removeItem("aicloser_impersonating_tenant");
          window.localStorage.removeItem("aicloser_impersonating_name");
          document.cookie = "gx_tenant=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        }
        const [{ leads: apiLeads }, poolRes, teamData] = await Promise.all([
          aicloserApi.leads.list({ limit: 1000 }).catch(() => ({ leads: [] })),
          aicloserApi.leads.getPool().catch(() => ({
            items: [],
            initialStageCount: null,
            grabCapacity: null,
            availableSlots: null,
            isAtQuota: null,
            initialStageLabel: "New Lead",
          })),
          aicloserApi.team.listMembers().catch(() => []),
        ]);
        const poolList = Array.isArray(poolRes) ? poolRes : ((poolRes as any)?.items || []);
        const poolCount = poolList.length;
        const poolQuota: PoolQuotaInfo | null =
          poolRes && typeof (poolRes as any).grabCapacity === "number"
            ? {
                initialStageCount: (poolRes as any).initialStageCount,
                grabCapacity: (poolRes as any).grabCapacity,
                availableSlots: (poolRes as any).availableSlots,
                isAtQuota: (poolRes as any).isAtQuota,
                initialStageLabel: (poolRes as any).initialStageLabel || "New Lead",
              }
            : null;
        const rawTeam = Array.isArray(teamData)
          ? teamData
          : Array.isArray((teamData as any)?.members)
          ? (teamData as any).members
          : Array.isArray((teamData as any)?.data?.members)
          ? (teamData as any).data.members
          : [];
        const teamMembers = rawTeam
          .filter((m: any) => {
            const role = (m.role || m.workspaceRole || m.user?.role || "").toUpperCase();
            return role !== "SUPER_ADMIN" && !role.includes("SUPER");
          })
          .map((m: any) => ({
            id: String(m.id || m.userId),
            name: m.displayName || m.user?.displayName || m.name || "Sales Agent",
            displayName: m.displayName || m.user?.displayName || m.name || "Sales Agent",
            role: m.role || m.workspaceRole || "SALES_AGENT",
          }));
        const userTheme: Theme | undefined = me.user?.themePreference
          ? (String(me.user.themePreference).toLowerCase() === "dark" ? "dark" : "light")
          : undefined;

        // Cleanly map leads and ALWAYS update state.leads (even if [] for a fresh workspace)
        const mapped = (apiLeads || []).map(backendLeadToUiLead);
        setState((p) => ({
          ...p,
          leads: mapped,
          poolLeads: poolList,
          poolCount,
          poolQuota,
          teamMembers: teamMembers.length > 0 ? teamMembers : p.teamMembers,
          theme: userTheme || p.theme,
          apiConnected: true,
          isLiveCloud: true,
          user: me.user,
          workspaceAuth: { user: me.user },
          isLoadingApi: false,
        }));
        return;
      }
      setState((p) => ({ ...p, apiConnected: false, isLiveCloud: false, workspaceAuth: null, isLoadingApi: false }));
    } catch {
      setState((p) => ({ ...p, apiConnected: false, isLiveCloud: false, workspaceAuth: null, isLoadingApi: false }));
    }
  }, []);

  useEffect(() => {
    if (state.hydrated) {
      void refreshLeads();
    }
  }, [state.hydrated, refreshLeads]);

  // Realtime Server-Sent Events (SSE) stream for multi-agent updates
  useEffect(() => {
    if (!state.apiConnected) return;

    try {
      const unsubscribe = aicloserApi.realtime.connect({
        onEvent: (event: { type: string; payload: any }) => {
          if (!event?.type) return;

          // Dispatch event to window so Chat and Calls views can react
          window.dispatchEvent(new CustomEvent("aicloser:realtime", { detail: event }));

          if (event.type === "lead.created" && event.payload) {
            const newLead = backendLeadToUiLead(event.payload);
            setState((prev) => {
              if (prev.leads.some((l) => l.id === newLead.id)) return prev;
              return { ...prev, leads: [newLead, ...prev.leads] };
            });
          } else if (
            (event.type === "lead.updated" || event.type === "lead.stage_changed") &&
            event.payload?.id
          ) {
            const updated = backendLeadToUiLead(event.payload);
            setState((prev) => ({
              ...prev,
              leads: prev.leads.map((l) => (l.id === updated.id ? updated : l)),
            }));
          } else if (event.type === "lead.deleted" && event.payload?.id) {
            setState((prev) => ({
              ...prev,
              leads: prev.leads.filter((l) => l.id !== event.payload.id),
            }));
          } else if (event.type === "lead.claimed" && event.payload) {
            const poolId = event.payload.poolItemId || event.payload.id;
            setState((prev) => ({
              ...prev,
              poolLeads: prev.poolLeads.filter((p) => p.id !== poolId),
              poolCount: Math.max(0, prev.poolCount - 1),
            }));
          }
        },
        onError: () => {
          // Keep working if SSE connection drops
        },
      });

      return () => {
        unsubscribe();
      };
    } catch {
      // Ignore if SSE unsupported in environment
    }
  }, [state.apiConnected]);

  const moveLead = useCallback((id: string, stage: StageId, targetLeadId?: string) => {
    let calculatedPos = 0;
    setState((prev) => {
      const currentLead = prev.leads.find((l) => l.id === id);
      if (!currentLead) return prev;

      // If moving within same stage and no targetLeadId or dropping on self, no-op
      if (currentLead.stage === stage && (!targetLeadId || targetLeadId === id)) {
        return prev;
      }

      const otherLeads = prev.leads.filter((l) => l.id !== id);
      const updatedMovedLead: Lead = {
        ...currentLead,
        stage,
        updatedAt: new Date().toISOString(),
      };

      let newLeads: Lead[];
      if (targetLeadId) {
        const targetIdx = otherLeads.findIndex((l) => l.id === targetLeadId);
        if (targetIdx !== -1) {
          newLeads = [
            ...otherLeads.slice(0, targetIdx),
            updatedMovedLead,
            ...otherLeads.slice(targetIdx),
          ];
        } else {
          newLeads = [updatedMovedLead, ...otherLeads];
        }
      } else {
        newLeads = [updatedMovedLead, ...otherLeads];
      }

      let stageIndex = 0;
      newLeads = newLeads.map((l) => {
        if (l.stage === stage) {
          const pos = stageIndex++;
          if (l.id === id) calculatedPos = pos;
          return { ...l, kanbanPosition: pos };
        }
        return l;
      });

      // Update poolQuota dynamically if lead moves into or out of initial stage
      const initialStageId = (STAGES[0]?.id || "new") as StageId;
      let nextQuota = prev.poolQuota;
      if (prev.poolQuota && currentLead.stage !== stage) {
        let count = prev.poolQuota.initialStageCount ?? 0;
        const cap = prev.poolQuota.grabCapacity ?? 25;
        if (currentLead.stage === initialStageId && stage !== initialStageId) {
          // Moved OUT of initial stage -> slot liberated immediately!
          count = Math.max(0, count - 1);
          const slots = Math.max(0, cap - count);
          nextQuota = {
            ...prev.poolQuota,
            initialStageCount: count,
            availableSlots: slots,
            isAtQuota: count >= cap,
          };
        } else if (currentLead.stage !== initialStageId && stage === initialStageId) {
          // Moved INTO initial stage -> slot taken
          count = count + 1;
          const slots = Math.max(0, cap - count);
          nextQuota = {
            ...prev.poolQuota,
            initialStageCount: count,
            availableSlots: slots,
            isAtQuota: count >= cap,
          };
        }
      }

      return {
        ...prev,
        leads: newLeads,
        poolQuota: nextQuota,
      };
    });

    if (state.apiConnected) {
      aicloserApi.leads.updateKanbanPosition(id, stageIdToBackendStage(stage), calculatedPos).catch((err) => {
        console.error("Failed to update Kanban stage on API:", err);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("aicloser:toast", {
              detail: { type: "error", message: `Failed to move lead stage: ${err?.message || "Server error"}` },
            }),
          );
        }
      });
    }
  }, [state.apiConnected]);

  const updateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setState((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === id ? { ...l, ...patch, id: l.id, updatedAt: new Date().toISOString() } : l,
      ),
    }));
    if (state.apiConnected) {
      aicloserApi.leads.update(id, uiLeadToBackendPayload(patch)).catch((err) => {
        console.error("Failed to update lead on API:", err);
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("aicloser:toast", {
              detail: { type: "error", message: `Failed to save lead updates: ${err?.message || "Server error"}` },
            }),
          );
        }
      });
    }
  }, [state.apiConnected]);

  const addLead = useCallback(async (input: Omit<Lead, "id" | "updatedAt" | "code">): Promise<Lead> => {
    const tempId = `ld-${Date.now().toString(36)}`;
    let optimisticLead: Lead;
    setState((prev) => {
      const highest = prev.leads.reduce((max, l) => {
        const n = Number(l.code?.replace(/\D/g, "")) || 0;
        return Math.max(max, n);
      }, 100);
      optimisticLead = {
        ...input,
        id: tempId,
        code: `CLO-${highest + 1}`,
        updatedAt: new Date().toISOString(),
      };
      return { ...prev, leads: [optimisticLead, ...prev.leads] };
    });

    if (state.apiConnected) {
      try {
        const created = await aicloserApi.leads.create(uiLeadToBackendPayload(input));
        if (created?.id) {
          const finalLead = backendLeadToUiLead(created);
          setState((prev) => ({
            ...prev,
            leads: prev.leads.map((l) => (l.id === tempId ? finalLead : l)),
          }));
          return finalLead;
        }
      } catch (err) {
        setState((prev) => ({
          ...prev,
          leads: prev.leads.filter((l) => l.id !== tempId),
        }));
        throw err;
      }
    }
    return optimisticLead!;
  }, [state.apiConnected]);

  const deleteLead = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, leads: prev.leads.filter((l) => l.id !== id) }));
    try {
      await aicloserApi.leads.delete(id);
      void refreshLeads();
    } catch (err: any) {
      console.error("Failed to delete lead from API:", err);
      void refreshLeads();
      throw err;
    }
  }, [refreshLeads]);

  const claimLead = useCallback((id: string, closerName?: string) => {
    const finalCloser = closerName || state.user?.displayName || "Admin";
    updateLead(id, {
      owner: finalCloser,
      tags: ["claimed-lead"],
      notes: `Claimed from open lead grab pool by ${finalCloser}.`,
    });
  }, [updateLead, state.user?.displayName]);

  const fetchPoolLeads = useCallback(async (params?: { maxVisibleToCloser?: number }): Promise<LeadPoolItem[]> => {
    setState((prev) => ({ ...prev, isPoolLoading: true }));
    try {
      const res = await aicloserApi.leads.getPool(params);
      const items = Array.isArray(res) ? res : (res?.items || []);
      const poolQuota: PoolQuotaInfo | null =
        res && typeof (res as any).grabCapacity === "number"
          ? {
              initialStageCount: (res as any).initialStageCount,
              grabCapacity: (res as any).grabCapacity,
              availableSlots: (res as any).availableSlots,
              isAtQuota: (res as any).isAtQuota,
              initialStageLabel: (res as any).initialStageLabel || "New Lead",
            }
          : null;
      setState((prev) => ({
        ...prev,
        poolLeads: items,
        poolCount: items.length,
        poolQuota: poolQuota || prev.poolQuota,
        isPoolLoading: false,
      }));
      return items;
    } catch {
      setState((prev) => ({ ...prev, isPoolLoading: false }));
      return [];
    }
  }, []);

  const autoDistributePool = useCallback(async () => {
    const res = await aicloserApi.leads.autoDistributePool();
    await Promise.all([fetchPoolLeads(), refreshLeads()]);
    return res;
  }, [fetchPoolLeads, refreshLeads]);

  const claimFromPool = useCallback(
    async (
      poolItemId: string,
      closerName?: string,
      assignedAgentId?: string
    ): Promise<{ success: boolean; message?: string; lead?: Lead }> => {
      const finalCloser = closerName || state.user?.displayName || "Admin";
      const currentItem = state.poolLeads.find((p) => p.id === poolItemId);

      // Optimistically remove from pool immediately
      setState((prev) => ({
        ...prev,
        poolLeads: prev.poolLeads.filter((p) => p.id !== poolItemId),
        poolCount: Math.max(0, prev.poolCount - 1),
      }));

      try {
        const res = await aicloserApi.leads.claimFromPool(poolItemId, assignedAgentId);
        if (res && (res as any).success !== false) {
          const rawLead = (res as any).data?.lead || (res as any).lead;
          const initialStageId = (STAGES[0]?.id || "new") as StageId;
          let newLead: Lead;
          if (rawLead && rawLead.id) {
            const mapped = backendLeadToUiLead(rawLead);
            newLead = {
              ...mapped,
              stage: initialStageId,
            };
          } else {
            newLead = {
              id: poolItemId,
              code: `CLO-${poolItemId.slice(-4).toUpperCase()}`,
              name: currentItem?.customerName || "Claimed Customer",
              company: currentItem?.serviceInterest || "Direct Enquiry",
              phone: currentItem?.customerPhone || "",
              email: currentItem?.customerEmail || "",
              value: Number(currentItem?.budgetAmount) || 0,
              source: normalizeSource(currentItem?.source || "Google Sheets"),
              segment: (currentItem?.segment as Segment) || "SMB",
              stage: initialStageId,
              priority: (currentItem?.priority as Priority) || "medium",
              owner: finalCloser,
              followUp: currentItem?.followUpAt || "",
              tags: ["grabbed-pool", currentItem?.source || "google-sheets"],
              notes: `⚡ Grabbed from open lead pool by ${finalCloser}.`,
              updatedAt: new Date().toISOString(),
            };
          }

          setState((prev) => {
            let nextQuota = prev.poolQuota;
            if (prev.poolQuota) {
              const cap = prev.poolQuota.grabCapacity ?? 25;
              const count = (prev.poolQuota.initialStageCount ?? 0) + 1;
              const slots = Math.max(0, cap - count);
              nextQuota = {
                ...prev.poolQuota,
                initialStageCount: count,
                availableSlots: slots,
                isAtQuota: count >= cap,
              };
            }
            return {
              ...prev,
              leads: [newLead, ...prev.leads.filter((l) => l.id !== newLead.id)],
              poolQuota: nextQuota,
            };
          });

          refreshLeads().catch(() => {});
          fetchPoolLeads().catch(() => {});
          return { success: true, message: "Lead grabbed successfully!", lead: newLead };
        } else {
          fetchPoolLeads().catch(() => {});
          const errMsg = (res as any)?.message || "Lead was already grabbed by another closer.";
          return { success: false, message: errMsg };
        }
      } catch (err: any) {
        if (!state.apiConnected || err?.status === 401 || String(err?.message || "").includes("401") || String(err?.message || "").includes("token")) {
          const initialStageId = (STAGES[0]?.id || "new") as StageId;
          const newLead: Lead = {
            id: poolItemId,
            code: `CLO-${poolItemId.slice(-4).toUpperCase()}`,
            name: currentItem?.customerName || "Claimed Customer",
            company: currentItem?.serviceInterest || "Direct Enquiry",
            phone: currentItem?.customerPhone || "",
            email: currentItem?.customerEmail || "",
            value: Number(currentItem?.budgetAmount) || 0,
            source: normalizeSource(currentItem?.source || "Google Sheets"),
            segment: (currentItem?.segment as Segment) || "SMB",
            stage: initialStageId,
            priority: (currentItem?.priority as Priority) || "medium",
            owner: finalCloser,
            followUp: currentItem?.followUpAt || "",
            tags: ["grabbed-pool", currentItem?.source || "google-sheets"],
            notes: `⚡ Grabbed from open lead pool by ${finalCloser}.`,
            updatedAt: new Date().toISOString(),
          };

          setState((prev) => ({
            ...prev,
            leads: [newLead, ...prev.leads.filter((l) => l.id !== newLead.id)],
          }));

          return { success: true, message: "Lead grabbed successfully!", lead: newLead };
        }

        fetchPoolLeads().catch(() => {});
        const msg = err?.message || "Lead is no longer available or was grabbed by another closer.";
        return { success: false, message: msg };
      }
    },
    [state.poolLeads, refreshLeads, fetchPoolLeads]
  );

  const reassignLead = useCallback((id: string, newOwner: string, note?: string) => {
    updateLead(id, {
      owner: newOwner,
      notes: note ? note : `Reassigned to ${newOwner}.`,
    });
  }, [updateLead]);

  const loginWorkspace = useCallback(
    async (
      identifierOrCreds: string | { email?: string; identifier?: string; password?: string; token?: string },
      pwdArg?: string
    ) => {
      try {
        setState((p) => ({ ...p, isLoadingApi: true }));
        if (typeof identifierOrCreds === "object") {
          if (identifierOrCreds.token) {
            if (typeof window !== "undefined") {
              window.localStorage.setItem("aicloser_token", identifierOrCreds.token);
              document.cookie = `aicloser_token=${encodeURIComponent(identifierOrCreds.token)}; path=/; max-age=2592000; SameSite=Lax`;
            }
            await refreshLeads();
            return { success: true };
          }
          const id = identifierOrCreds.identifier || identifierOrCreds.email || "";
          const pw = identifierOrCreds.password || "";
          const result = await aicloserApi.auth.login({ identifier: id, password: pw, clientType: "DESKTOP" });
          if (result?.token) {
            await refreshLeads();
            return { success: true };
          }
          return { success: false, error: "Invalid credentials" };
        } else {
          const result = await aicloserApi.auth.login({ identifier: identifierOrCreds, password: pwdArg || "", clientType: "DESKTOP" });
          if (result?.token) {
            await refreshLeads();
            return { success: true };
          }
          return { success: false, error: "Invalid credentials" };
        }
      } catch (e: any) {
        setState((p) => ({ ...p, isLoadingApi: false }));
        return { success: false, error: e?.message || "Failed to sign in" };
      }
    },
    [refreshLeads]
  );

  const signupWorkspace = useCallback(
    async (params: {
      companyName: string;
      adminName: string;
      email: string;
      phone: string;
      password: string;
      teamSize?: string;
    }) => {
      try {
        setState((p) => ({ ...p, isLoadingApi: true }));
        const result = await aicloserApi.auth.signup(params);
        if (result?.token) {
          await refreshLeads();
          return { success: true };
        }
        return { success: false, error: "Signup succeeded but no token received" };
      } catch (e: any) {
        setState((p) => ({ ...p, isLoadingApi: false }));
        return { success: false, error: e?.message || "Failed to create workspace" };
      }
    },
    [refreshLeads],
  );

  const logoutWorkspace = useCallback(async () => {
    await aicloserApi.auth.logout().catch(() => {});
    if (typeof window !== "undefined") {
      const keysToRemove = [
        "aicloser_token",
        "closer_token",
        "aicloser_auth_token",
        "token",
        "aicloser_user_session",
        "aicloser_impersonation_parent",
        "aicloser_active_conversation",
        "closer.ui.v2",
        "closer.active_tab",
      ];
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
      try {
        window.sessionStorage.clear();
      } catch {}
      const expired = "path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = `aicloser_token=; ${expired}`;
      document.cookie = `aicloser_auth_token=; ${expired}`;
      document.cookie = `closer_token=; ${expired}`;
      document.cookie = `auth_token=; ${expired}`;
      document.cookie = `token=; ${expired}`;
      document.cookie = `gx_session=; ${expired}`;
      document.cookie = `gx_role=; ${expired}`;
      document.cookie = `gx_tenant=; ${expired}`;
      window.location.href = "/login";
    }
    setState((p) => ({ ...p, apiConnected: false, isLiveCloud: false, user: null, workspaceAuth: null }));
  }, []);

  const setTheme = useCallback((theme: Theme) => {
    setState((p) => ({
      ...p,
      theme,
      user: p.user ? { ...p.user, themePreference: theme } : p.user,
    }));
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("aicloser_theme", theme);
      }
    } catch {}
    aicloserApi.users.updateTheme(theme).catch(() => {});
  }, []);
  const setDensity = useCallback((density: Density) => setState((p) => ({ ...p, density })), []);
  const setAccent = useCallback(
    (accent: string) => setState((p) => ({ ...p, accent: normalizeAccent(accent) })),
    [],
  );
  const setFontScale = useCallback(
    (fontScale: FontScale) => setState((p) => ({ ...p, fontScale: normalizeFontScale(fontScale) })),
    [],
  );
  const setNavSpacing = useCallback(
    (navSpacing: NavSpacing) => setState((p) => ({ ...p, navSpacing: normalizeNavSpacing(navSpacing) })),
    [],
  );
  const toggleSidebar = useCallback(
    () => setState((p) => ({ ...p, sidebarCollapsed: !p.sidebarCollapsed })),
    [],
  );
  const setScope = useCallback((scope: Scope) => setState((p) => ({ ...p, scope })), []);
  const setPalette = useCallback((paletteOpen: boolean) => setState((p) => ({ ...p, paletteOpen })), []);
  const setSheet = useCallback((sheetOpen: boolean) => setState((p) => ({ ...p, sheetOpen })), []);
  const setQuickAdd = useCallback((quickAddOpen: boolean) => setState((p) => ({ ...p, quickAddOpen })), []);

  const setLayout = useCallback<AppApi["setLayout"]>((patch) => {
    setState((prev) => ({
      ...prev,
      sidebarWidth:
        patch.sidebarWidth !== undefined
          ? clamp(patch.sidebarWidth, LIMITS.sidebar)
          : prev.sidebarWidth,
      colWidth: patch.colWidth !== undefined ? clamp(patch.colWidth, LIMITS.col) : prev.colWidth,
      drawerWidth:
        patch.drawerWidth !== undefined ? clamp(patch.drawerWidth, LIMITS.drawer) : prev.drawerWidth,
    }));
  }, []);

  const reset = useCallback(() => {
    setState((prev) => ({ ...prev, leads: [] }));
    try {
      window.localStorage.removeItem(KEY);
    } catch {}
  }, []);

  useEffect(() => {
    let active = true;
    aicloserApi.ai
      .getBotConfig()
      .then((res: any) => {
        if (!active) return;
        const cfg = res?.data || res;
        if (cfg && typeof cfg.enabled === "boolean") {
          setState((p) => ({ ...p, globalAiBotEnabled: cfg.enabled }));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleGlobalAiBot = useCallback(async () => {
    const nextVal = !state.globalAiBotEnabled;
    setState((p) => ({ ...p, globalAiBotEnabled: nextVal, isTogglingAiBot: true }));
    try {
      await aicloserApi.ai.updateBotConfig({ enabled: nextVal });
      setState((p) => ({ ...p, isTogglingAiBot: false }));
      return nextVal;
    } catch (err) {
      setState((p) => ({ ...p, globalAiBotEnabled: !nextVal, isTogglingAiBot: false }));
      throw err;
    }
  }, [state.globalAiBotEnabled]);

  const setGlobalAiBotEnabled = useCallback((enabled: boolean) => {
    setState((p) => ({ ...p, globalAiBotEnabled: enabled }));
  }, []);

  const api = useMemo<AppApi>(
    () => ({
      state,
      toggleGlobalAiBot,
      setGlobalAiBotEnabled,
      moveLead,
      updateLead,
      addLead,
      deleteLead,
      claimLead,
      claimFromPool,
      autoDistributePool,
      fetchPoolLeads,
      reassignLead,
      refreshLeads,
      loginWorkspace,
      signupWorkspace,
      logoutWorkspace,
      setTheme,
      setDensity,
      setAccent,
      setFontScale,
      setNavSpacing,
      toggleSidebar,
      setScope,
      setLayout,
      setPalette,
      setSheet,
      setQuickAdd,
      reset,
    }),
    [
      state,
      toggleGlobalAiBot,
      setGlobalAiBotEnabled,
      moveLead,
      updateLead,
      addLead,
      deleteLead,
      claimLead,
      claimFromPool,
      fetchPoolLeads,
      reassignLead,
      refreshLeads,
      loginWorkspace,
      signupWorkspace,
      logoutWorkspace,
      setTheme,
      setDensity,
      setAccent,
      setFontScale,
      setNavSpacing,
      toggleSidebar,
      setScope,
      setLayout,
      setPalette,
      setSheet,
      setQuickAdd,
      reset,
    ],
  );

  return <AppContext.Provider value={api}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside <AppProvider>");
  return ctx;
}

/** Leads after the topbar "viewing data for" scope is applied. */
export function useScopedLeads() {
  const { state } = useApp();
  return useMemo(() => {
    const myName = (state.user?.displayName || CURRENT_USER).toLowerCase();
    const myId = (state.user as any)?.userId || (state.user as any)?.id;
    const isCloser = (state.user?.role as string) === "CLOSER" || state.user?.role === "SALES_AGENT";
    if (isCloser || state.scope === "mine") {
      return state.leads.filter(
        (l) =>
          (l.owner && l.owner.toLowerCase() === myName) ||
          (myId && (l as any).assignedAgentId === myId)
      );
    }
    if (state.scope === "unassigned") return state.leads.filter((l) => (!l.owner || l.owner === "Unassigned") && !isTeammateScannedWhatsAppLead(l));
    if (state.scope.startsWith("agent:")) {
      const targetAgent = state.scope.slice(6).trim().toLowerCase();
      return state.leads.filter(
        (l) => (l.owner || "").toLowerCase() === targetAgent || (l.owner || "").toLowerCase().includes(targetAgent)
      );
    }
    // Default "all" scope (All team leads):
    // Strictly isolate teammates' scanned WhatsApp chats from the general company Kanban/leads pool.
    // Teammate scanned WhatsApp chats will only appear when viewing that teammate specifically.
    return state.leads.filter((l) => !isTeammateScannedWhatsAppLead(l));
  }, [state.leads, state.scope, state.user]);
}

/** Mask phone numbers for closer isolation to prevent lead theft. */
export function maskPhone(phone?: string | null, shouldMask: boolean = false): string {
  if (!phone) return "";
  if (!shouldMask) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    const first5 = digits.slice(-10, -5);
    return `+91 ${first5} •••••`;
  }
  return phone.slice(0, Math.floor(phone.length / 2)) + " •••••";
}

export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const compactMoney = (n: number) => {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${Math.round(n / 1000)}k`;
  return `₹${n}`;
};

/**
 * Coarse relative label. Buckets are wide enough that a server render and the
 * hydration a moment later produce the same string, and date fallbacks pin a
 * time zone so both environments format identically.
 */
export const relativeTime = (iso?: string | null) => {
  if (!iso) return "just now";
  const parsed = new Date(iso).getTime();
  if (isNaN(parsed)) return "just now";
  const diff = Date.now() - parsed;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
};

/** SLA label for a follow-up date: "3d overdue" / "in 2d" / "today" / "no date". */
export const slaLabel = (iso?: string | null) => {
  if (!iso) return "no date";
  const target = new Date(iso);
  if (isNaN(target.getTime())) return "no date";
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "1d overdue";
  if (days > 1) return `in ${days}d`;
  return `${Math.abs(days)}d overdue`;
};

export const isOverdue = (iso?: string | null) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return !isNaN(t) && t < Date.now();
};

/** Platform-aware modifier label for keyboard hints. */
export const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const modKey = () => (isMac() ? "⌘" : "Ctrl");

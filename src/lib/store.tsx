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
import { SEED_LEADS } from "./data";
import type { Density, FontScale, Lead, StageId, Theme } from "./types";

const KEY = "closer.ui.v2";

export type Scope = "all" | "mine" | "unassigned";

interface Persisted {
  leads: Lead[];
  theme: Theme;
  density: Density;
  /** Accent colour as a hex string. */
  accent: string;
  /** Base type scale. */
  fontScale: FontScale;
  sidebarWidth: number;
  colWidth: number;
  drawerWidth: number;
}

interface AppState extends Persisted {
  sidebarCollapsed: boolean;
  scope: Scope;
  hydrated: boolean;
  /** Global overlay state, driven by the keyboard layer. */
  paletteOpen: boolean;
  sheetOpen: boolean;
  quickAddOpen: boolean;
}

interface AppApi {
  state: AppState;
  moveLead: (id: string, stage: StageId) => void;
  updateLead: (id: string, patch: Partial<Lead>) => void;
  addLead: (lead: Omit<Lead, "id" | "updatedAt" | "code">) => void;
  deleteLead: (id: string) => void;
  setTheme: (theme: Theme) => void;
  setDensity: (density: Density) => void;
  setAccent: (accent: string) => void;
  setFontScale: (scale: FontScale) => void;
  toggleSidebar: () => void;
  setScope: (scope: Scope) => void;
  setLayout: (patch: Partial<Pick<Persisted, "sidebarWidth" | "colWidth" | "drawerWidth">>) => void;
  setPalette: (open: boolean) => void;
  setSheet: (open: boolean) => void;
  setQuickAdd: (open: boolean) => void;
  reset: () => void;
}

const AppContext = createContext<AppApi | null>(null);

export const CURRENT_USER = "Aarav";

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

/** Apply accent + type scale to the document root. Safe to call pre-hydration. */
export function applyAppearance(accent: string, fontScale: FontScale, theme: Theme) {
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
  const fonts = fontTokens(fontScale);
  for (const [name, value] of Object.entries(fonts)) {
    root.style.setProperty(`--fs-${name}`, value);
  }
}

const normalizeAccent = (value: unknown): string =>
  typeof value === "string" && HEX.test(value.trim()) ? value.trim() : BRAND_ACCENT;

const normalizeFontScale = (value: unknown): FontScale =>
  value === "sm" || value === "lg" || value === "xl" ? value : "md";

const initialState: AppState = {
  leads: SEED_LEADS,
  theme: "dark",
  density: "comfortable",
  accent: BRAND_ACCENT,
  fontScale: "md",
  sidebarWidth: 244,
  colWidth: 288,
  drawerWidth: 460,
  sidebarCollapsed: false,
  scope: "all",
  hydrated: false,
  paletteOpen: false,
  sheetOpen: false,
  quickAddOpen: false,
};

const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, Math.round(value)));

function readStorage(): Partial<Persisted> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<Persisted>) : null;
  } catch {
    return null;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = readStorage();
    setState((prev) => ({
      ...prev,
      hydrated: true,
      leads: saved?.leads?.length ? saved.leads : prev.leads,
      theme: saved?.theme === "light" || saved?.theme === "dark" ? saved.theme : prev.theme,
      density: saved?.density === "compact" ? "compact" : "comfortable",
      accent: normalizeAccent(saved?.accent),
      fontScale: normalizeFontScale(saved?.fontScale),
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
    applyAppearance(state.accent, state.fontScale, state.theme);
  }, [
    state.theme,
    state.density,
    state.accent,
    state.fontScale,
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
    state.sidebarWidth,
    state.colWidth,
    state.drawerWidth,
    state.hydrated,
  ]);

  const moveLead = useCallback((id: string, stage: StageId) => {
    setState((prev) => {
      const target = prev.leads.find((l) => l.id === id);
      if (!target || target.stage === stage) return prev;
      return {
        ...prev,
        leads: prev.leads.map((l) =>
          l.id === id ? { ...l, stage, updatedAt: new Date().toISOString() } : l,
        ),
      };
    });
  }, []);

  const updateLead = useCallback((id: string, patch: Partial<Lead>) => {
    setState((prev) => ({
      ...prev,
      leads: prev.leads.map((l) =>
        l.id === id ? { ...l, ...patch, id: l.id, updatedAt: new Date().toISOString() } : l,
      ),
    }));
  }, []);

  const addLead = useCallback((input: Omit<Lead, "id" | "updatedAt" | "code">) => {
    setState((prev) => {
      const highest = prev.leads.reduce((max, l) => {
        const n = Number(l.code?.replace(/\D/g, "")) || 0;
        return Math.max(max, n);
      }, 100);
      const lead: Lead = {
        ...input,
        id: `ld-${Date.now().toString(36)}`,
        code: `CLO-${highest + 1}`,
        updatedAt: new Date().toISOString(),
      };
      return { ...prev, leads: [lead, ...prev.leads] };
    });
  }, []);

  const deleteLead = useCallback((id: string) => {
    setState((prev) => ({ ...prev, leads: prev.leads.filter((l) => l.id !== id) }));
  }, []);

  const setTheme = useCallback((theme: Theme) => setState((p) => ({ ...p, theme })), []);
  const setDensity = useCallback((density: Density) => setState((p) => ({ ...p, density })), []);
  const setAccent = useCallback(
    (accent: string) => setState((p) => ({ ...p, accent: normalizeAccent(accent) })),
    [],
  );
  const setFontScale = useCallback(
    (fontScale: FontScale) => setState((p) => ({ ...p, fontScale: normalizeFontScale(fontScale) })),
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

  const reset = useCallback(() => setState((prev) => ({ ...prev, leads: SEED_LEADS })), []);

  const api = useMemo<AppApi>(
    () => ({
      state,
      moveLead,
      updateLead,
      addLead,
      deleteLead,
      setTheme,
      setDensity,
      setAccent,
      setFontScale,
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
      moveLead,
      updateLead,
      addLead,
      deleteLead,
      setTheme,
      setDensity,
      setAccent,
      setFontScale,
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
    if (state.scope === "mine") return state.leads.filter((l) => l.owner === CURRENT_USER);
    if (state.scope === "unassigned") return state.leads.filter((l) => l.owner === "Unassigned");
    return state.leads;
  }, [state.leads, state.scope]);
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
export const relativeTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
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

/** SLA label for a follow-up date: "3d overdue" / "in 2d" / "today". */
export const slaLabel = (iso: string) => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1) return `in ${days}d`;
  return `${Math.abs(days)}d overdue`;
};

export const isOverdue = (iso: string) => new Date(iso).getTime() < Date.now();

/** Platform-aware modifier label for keyboard hints. */
export const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const modKey = () => (isMac() ? "⌘" : "Ctrl");

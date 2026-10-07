"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const savedTheme = localStorage.getItem("ai-closer-theme") as Theme | null;
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
        applyTheme(savedTheme);
      } else {
        // Default to dark mode for pro sales dashboard, or honor system if preferred
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initialTheme: Theme = prefersDark ? "dark" : "dark";
        setTheme(initialTheme);
        applyTheme(initialTheme);
      }
    } catch {
      // Fallback if localStorage is inaccessible
      applyTheme("dark");
    }
  }, []);

  const applyTheme = (nextTheme: Theme) => {
    const root = document.documentElement;
    root.setAttribute("data-theme", nextTheme);
    if (nextTheme === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
    }
  };

  const handleToggle = (nextTheme: Theme) => {
    setTheme(nextTheme);
    applyTheme(nextTheme);
    try {
      localStorage.setItem("ai-closer-theme", nextTheme);
    } catch {}
  };

  if (!mounted) {
    return (
      <div
        className={`theme-switcher-skeleton ${className}`}
        style={{
          width: "72px",
          height: "32px",
          borderRadius: "20px",
          background: "var(--color-surface-soft, rgba(255, 255, 255, 0.05))",
          border: "1px solid var(--color-border, rgba(255, 255, 255, 0.08))",
        }}
      />
    );
  }

  return (
    <div
      className={`theme-toggle-segmented ${className}`}
      role="group"
      aria-label="Theme selection"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px",
        borderRadius: "24px",
        background: "var(--color-surface-soft)",
        border: "1px solid var(--color-border-strong)",
        gap: "2px",
        position: "relative",
      }}
    >
      <button
        type="button"
        onClick={() => handleToggle("light")}
        aria-label="Switch to Light mode"
        aria-pressed={theme === "light"}
        title="Light mode"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "5px",
          padding: "5px 12px",
          borderRadius: "18px",
          border: "none",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          background: theme === "light" ? "var(--color-surface, #ffffff)" : "transparent",
          color: theme === "light" ? "var(--closer-orange, #ff6b2f)" : "var(--color-text-secondary)",
          boxShadow: theme === "light" ? "0 1px 4px rgba(0, 0, 0, 0.08), 0 0 0 1px var(--closer-orange-border)" : "none",
        }}
      >
        <Sun size={14} strokeWidth={2.4} />
        <span className="theme-toggle-label" style={{ fontSize: "11px", letterSpacing: "0.02em" }}>Light</span>
      </button>

      <button
        type="button"
        onClick={() => handleToggle("dark")}
        aria-label="Switch to Dark mode"
        aria-pressed={theme === "dark"}
        title="Dark mode"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "5px",
          padding: "5px 12px",
          borderRadius: "18px",
          border: "none",
          fontSize: "12px",
          fontWeight: 700,
          cursor: "pointer",
          transition: "all 0.18s cubic-bezier(0.16, 1, 0.3, 1)",
          background: theme === "dark" ? "var(--color-surface-elevated, #26282d)" : "transparent",
          color: theme === "dark" ? "var(--closer-orange, #ff6b2f)" : "var(--color-text-secondary)",
          boxShadow: theme === "dark" ? "0 1px 4px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--closer-orange-border)" : "none",
        }}
      >
        <Moon size={14} strokeWidth={2.4} />
        <span className="theme-toggle-label" style={{ fontSize: "11px", letterSpacing: "0.02em" }}>Dark</span>
      </button>
    </div>
  );
}

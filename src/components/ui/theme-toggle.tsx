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
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        const initialTheme: Theme = prefersDark ? "dark" : "dark";
        setTheme(initialTheme);
        applyTheme(initialTheme);
      }
    } catch {
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
        className={`seg ${className}`}
        style={{ width: "72px", height: "28px" }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className={`seg ${className}`}
      role="group"
      aria-label="Theme selection"
    >
      <button
        type="button"
        onClick={() => handleToggle("light")}
        aria-label="Switch to Light mode"
        aria-pressed={theme === "light"}
        data-on={theme === "light"}
        title="Light mode"
      >
        <Sun size={13} strokeWidth={2.4} />
        <span className="theme-toggle-label">Light</span>
      </button>

      <button
        type="button"
        onClick={() => handleToggle("dark")}
        aria-label="Switch to Dark mode"
        aria-pressed={theme === "dark"}
        data-on={theme === "dark"}
        title="Dark mode"
      >
        <Moon size={13} strokeWidth={2.4} />
        <span className="theme-toggle-label">Dark</span>
      </button>
    </div>
  );
}

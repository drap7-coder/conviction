"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "dark" | "cream";
const STORAGE_KEY = "iqbulls-theme";

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "cream" ? "light" : "dark";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "cream" ? "#F4EDDF" : "#0A0E14");
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const initial = document.documentElement.dataset.theme === "cream" ? "cream" : "dark";
    setTheme(initial);
    applyTheme(initial);

    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = event.newValue === "cream" ? "cream" : "dark";
      setTheme(next);
      applyTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleTheme() {
    const next = theme === "cream" ? "dark" : "cream";
    setTheme(next);
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
  }

  const cream = theme === "cream";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={`Use ${cream ? "dark" : "cream"} theme`}
      aria-pressed={cream}
      title={`Use ${cream ? "dark" : "cream"} theme`}
      onClick={toggleTheme}
    >
      {cream ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
      <span>{cream ? "Dark" : "Cream"}</span>
    </button>
  );
}

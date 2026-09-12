"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { RunningBull } from "@/components/RunningBull";

export type SurfaceTheme = "dark" | "cream";
export type AccentTheme = "green" | "blue" | "violet" | "pink" | "mono";

const SURFACE_KEY = "iqbulls-theme";
const ACCENT_KEY = "iqbulls-accent";

export const ACCENT_OPTIONS: Array<{ id: AccentTheme; label: string; swatch: string }> = [
  { id: "green", label: "Bull Green", swatch: "#2dd4bf" },
  { id: "blue", label: "Electric Blue", swatch: "#3b82f6" },
  { id: "violet", label: "Violet", swatch: "#8b5cf6" },
  { id: "pink", label: "Hot Pink", swatch: "#ec4899" },
  { id: "mono", label: "Monochrome", swatch: "#94a3b8" },
];

function isAccent(value: string | null | undefined): value is AccentTheme {
  return value === "green"
    || value === "blue"
    || value === "violet"
    || value === "pink"
    || value === "mono";
}

export function applySurfaceTheme(theme: SurfaceTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme === "cream" ? "light" : "dark";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "cream" ? "#F4EDDF" : "#0A0E14");
}

export function applyAccentTheme(accent: AccentTheme) {
  document.documentElement.dataset.accent = accent;
}

type AccentPickerProps = {
  onAccentChange?: (accent: AccentTheme) => void;
};

/**
 * Compact surface + accent control. Decorative accent never overrides
 * semantic green/red used for market direction.
 */
export function AccentPicker({ onAccentChange }: AccentPickerProps) {
  const [accent, setAccent] = useState<AccentTheme>("green");
  const [bullToken, setBullToken] = useState(0);

  useEffect(() => {
    const initialAccent = isAccent(document.documentElement.dataset.accent)
      ? document.documentElement.dataset.accent
      : "green";
    setAccent(initialAccent);
    applyAccentTheme(initialAccent);

    const sync = (event: StorageEvent) => {
      if (event.key === ACCENT_KEY && isAccent(event.newValue)) {
        setAccent(event.newValue);
        applyAccentTheme(event.newValue);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function chooseAccent(next: AccentTheme) {
    setAccent(next);
    applyAccentTheme(next);
    localStorage.setItem(ACCENT_KEY, next);
    setBullToken((token) => token + 1);
    onAccentChange?.(next);
  }

  return (
    <>
      <div className="theme-picker-accents" role="radiogroup" aria-label="Accent color">
        {ACCENT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            className="theme-picker-swatch"
            role="radio"
            aria-checked={accent === option.id}
            aria-pressed={accent === option.id}
            aria-label={option.label}
            title={option.label}
            style={{ ["--swatch"]: option.swatch } as CSSProperties}
            onClick={() => chooseAccent(option.id)}
          />
        ))}
      </div>
      <RunningBull playToken={bullToken} />
    </>
  );
}

export function ThemeToggle() {
  const [surface, setSurface] = useState<SurfaceTheme>("dark");

  useEffect(() => {
    const initial = document.documentElement.dataset.theme === "cream" ? "cream" : "dark";
    setSurface(initial);
    applySurfaceTheme(initial);

    const sync = (event: StorageEvent) => {
      if (event.key !== SURFACE_KEY) return;
      const next = event.newValue === "cream" ? "cream" : "dark";
      setSurface(next);
      applySurfaceTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function toggleSurface() {
    const next = surface === "cream" ? "dark" : "cream";
    setSurface(next);
    applySurfaceTheme(next);
    localStorage.setItem(SURFACE_KEY, next);
  }

  const nextLabel = surface === "cream" ? "Use dark theme" : "Use light theme";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggleSurface}
    >
      {surface === "cream" ? <Moon size={15} aria-hidden="true" /> : <Sun size={15} aria-hidden="true" />}
      <span>{surface === "cream" ? "Dark" : "Light"}</span>
    </button>
  );
}

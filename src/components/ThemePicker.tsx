"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";

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

type ThemePickerProps = {
  onAccentChange?: (accent: AccentTheme) => void;
};

/**
 * Compact surface + accent control. Decorative accent never overrides
 * semantic green/red used for market direction.
 */
export function ThemePicker({ onAccentChange }: ThemePickerProps) {
  const [surface, setSurface] = useState<SurfaceTheme>("dark");
  const [accent, setAccent] = useState<AccentTheme>("green");

  useEffect(() => {
    const initialSurface =
      document.documentElement.dataset.theme === "cream" ? "cream" : "dark";
    const initialAccent = isAccent(document.documentElement.dataset.accent)
      ? document.documentElement.dataset.accent
      : "green";
    setSurface(initialSurface);
    setAccent(initialAccent);
    applySurfaceTheme(initialSurface);
    applyAccentTheme(initialAccent);

    const sync = (event: StorageEvent) => {
      if (event.key === SURFACE_KEY) {
        const next = event.newValue === "cream" ? "cream" : "dark";
        setSurface(next);
        applySurfaceTheme(next);
      }
      if (event.key === ACCENT_KEY && isAccent(event.newValue)) {
        setAccent(event.newValue);
        applyAccentTheme(event.newValue);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  function chooseSurface(next: SurfaceTheme) {
    setSurface(next);
    applySurfaceTheme(next);
    localStorage.setItem(SURFACE_KEY, next);
  }

  function chooseAccent(next: AccentTheme) {
    setAccent(next);
    applyAccentTheme(next);
    localStorage.setItem(ACCENT_KEY, next);
    onAccentChange?.(next);
  }

  return (
    <div className="theme-picker" role="group" aria-label="Appearance">
      <div className="theme-picker-surfaces" role="group" aria-label="Surface">
        <button
          type="button"
          className="theme-picker-surface"
          aria-pressed={surface === "dark"}
          aria-label="Dark surface"
          title="Dark"
          onClick={() => chooseSurface("dark")}
        >
          <Moon size={14} aria-hidden="true" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          className="theme-picker-surface"
          aria-pressed={surface === "cream"}
          aria-label="Cream surface"
          title="Cream"
          onClick={() => chooseSurface("cream")}
        >
          <Sun size={14} aria-hidden="true" />
          <span>Cream</span>
        </button>
      </div>
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
    </div>
  );
}

/** @deprecated Prefer ThemePicker — kept as a thin alias for older imports. */
export function ThemeToggle() {
  return <ThemePicker />;
}

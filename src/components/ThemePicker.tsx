"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { RunningBull } from "@/components/RunningBull";

export type AccentTheme = "green" | "blue" | "violet" | "pink" | "mono";

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

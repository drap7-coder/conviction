"use client";

import type { CSSProperties } from "react";

export type SurfaceSlicerTone = "default" | "up" | "down";

export type SurfaceSlicerOption = {
  id: string;
  label: string;
  /** Active-state accent: up = leaders (green), down = laggards (red). */
  tone?: SurfaceSlicerTone;
};

type SurfaceSlicerProps = {
  label: string;
  options: SurfaceSlicerOption[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
  style?: CSSProperties;
  /** Use radiogroup semantics for mutually exclusive filters (default). */
  role?: "tablist" | "radiogroup" | "group";
};

/**
 * Compact dark pill track — same language as Portfolio Live/Study + Compare pills.
 * Track scrolls horizontally on narrow viewports so long category rows stay usable.
 */
export function SurfaceSlicer({
  label,
  options,
  activeId,
  onChange,
  className,
  style,
  role = "radiogroup",
}: SurfaceSlicerProps) {
  return (
    <div
      className={["surface-slicer", className].filter(Boolean).join(" ")}
      style={style}
      role={role}
      aria-label={label}
    >
      <div className="surface-slicer-track">
        {options.map((option) => {
          const selected = activeId === option.id;
          const tone = option.tone ?? "default";
          return (
            <button
              key={option.id}
              type="button"
              role={role === "tablist" ? "tab" : role === "radiogroup" ? "radio" : undefined}
              aria-checked={role === "radiogroup" ? selected : undefined}
              aria-selected={role === "tablist" ? selected : undefined}
              aria-pressed={role === "group" ? selected : undefined}
              tabIndex={selected ? 0 : -1}
              className={[
                "surface-slicer-pill",
                selected ? "is-active" : "",
                tone !== "default" ? `tone-${tone}` : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

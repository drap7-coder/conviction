"use client";

import { useRef, type CSSProperties, type KeyboardEvent } from "react";

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
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function moveSelection(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % options.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + options.length) % options.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onChange(options[nextIndex].id);
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <div
      className={["surface-slicer", className].filter(Boolean).join(" ")}
      style={style}
      role={role}
      aria-label={label}
    >
      <div className="surface-slicer-track">
        {options.map((option, index) => {
          const selected = activeId === option.id;
          const tone = option.tone ?? "default";
          return (
            <button
              key={option.id}
              ref={(element) => { optionRefs.current[index] = element; }}
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
              onKeyDown={(event) => moveSelection(event, index)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

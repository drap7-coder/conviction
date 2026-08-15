"use client";

import type { CSSProperties, ReactNode } from "react";

export type ViewSwitcherOption = {
  /** Selection value passed to onChange. */
  id: string;
  label: string;
  tabId: string;
  panelId: string;
};

type ViewSwitcherProps = {
  label: string;
  options: ViewSwitcherOption[];
  activeId: string;
  onChange: (id: string) => void;
  /** Quiet context under the tabs — not a competing hero. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
};

export function ViewSwitcher({
  label,
  options,
  activeId,
  onChange,
  children,
  className,
  style,
}: ViewSwitcherProps) {
  function selectView(option: ViewSwitcherOption) {
    onChange(option.id);
    window.requestAnimationFrame(() => {
      const switcher = document.getElementById(option.tabId)?.closest(".view-switch");
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      switcher?.scrollIntoView({
        behavior: reducedMotion ? "auto" : "smooth",
        block: "start",
      });
    });
  }

  return (
    <div className={["view-switch", className].filter(Boolean).join(" ")} style={style}>
      <div className="view-switch-tabs" role="tablist" aria-label={label}>
        {options.map((option) => {
          const selected = activeId === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="tab"
              id={option.tabId}
              aria-selected={selected}
              aria-controls={option.panelId}
              tabIndex={selected ? 0 : -1}
              className={["view-switch-tab", selected ? "is-active" : ""].filter(Boolean).join(" ")}
              onClick={() => selectView(option)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {children ? <div className="view-switch-context">{children}</div> : null}
    </div>
  );
}

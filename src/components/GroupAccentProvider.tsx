"use client";

import { useEffect, useState } from "react";
import type { Group } from "@/lib/groups/types";

const STORAGE_KEY = "conviction-primary-group-color";
const SKIP_ONBOARDING_KEY = "conviction-groups-onboarding-skipped";

export function readStoredPrimaryColor(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredPrimaryColor(color: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (!color) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, color);
  } catch {
    // ignore
  }
}

/** Injects --group-accent from the viewer's primary group (guest localStorage or API). */
export function GroupAccentProvider({ children }: { children: React.ReactNode }) {
  const [color, setColor] = useState<string | null>(null);

  useEffect(() => {
    setColor(readStoredPrimaryColor());
    let cancelled = false;
    void fetch("/api/groups", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { primaryGroup?: Group | null } | null) => {
        if (cancelled || !data) return;
        const next = data.primaryGroup?.primaryColor ?? null;
        if (next) {
          writeStoredPrimaryColor(next);
          setColor(next);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (color) root.style.setProperty("--group-accent", color);
    else root.style.removeProperty("--group-accent");
  }, [color]);

  return <>{children}</>;
}

export { SKIP_ONBOARDING_KEY };

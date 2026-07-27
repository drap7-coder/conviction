"use client";

import { useEffect, useState, type ReactNode } from "react";

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

/**
 * Shows public examples only when the visitor has not started a personal list yet.
 * Keeps the watchlist page focused on the user’s companies once they exist.
 */
export function BuildingConvictionGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setVisible(false);
      }
    } catch {
      // Keep examples visible if storage is unavailable.
    }
  }, []);

  if (!visible) return null;
  return children;
}

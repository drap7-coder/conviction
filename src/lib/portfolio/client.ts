"use client";

import {
  loadPositions,
  savePositions,
  type PersistedPosition,
} from "@/lib/portfolio/persist";

const PORTFOLIO_MIGRATION_KEY = "conviction-portfolio-migrated";

export interface PortfolioViewerState {
  positions: PersistedPosition[];
  authenticated: boolean;
  persistence: "browser" | "neon" | "unconfigured";
}

function hasMigratedPortfolio() {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(PORTFOLIO_MIGRATION_KEY) === "1";
}

function markPortfolioMigrated() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PORTFOLIO_MIGRATION_KEY, "1");
}

export async function loadPortfolioForViewer(): Promise<PortfolioViewerState> {
  const browserPositions = loadPositions();

  try {
    const response = await fetch("/api/portfolio", { cache: "no-store" });
    if (!response.ok) throw new Error("Portfolio sync is temporarily unavailable");
    const data = await response.json() as {
      authenticated?: boolean;
      positions?: PersistedPosition[];
      persistence?: "browser" | "neon" | "unconfigured";
    };

    if (!data.authenticated) {
      return { positions: browserPositions, authenticated: false, persistence: "browser" };
    }

    let positions = data.positions ?? [];
    if (browserPositions.length > 0 && !hasMigratedPortfolio()) {
      const migration = await fetch("/api/portfolio/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ positions: browserPositions }),
      });
      if (migration.ok) {
        const migrated = await migration.json() as { positions?: PersistedPosition[] };
        positions = migrated.positions ?? positions;
        markPortfolioMigrated();
      }
    }

    return {
      positions,
      authenticated: true,
      persistence: data.persistence ?? "neon",
    };
  } catch {
    return { positions: browserPositions, authenticated: false, persistence: "unconfigured" };
  }
}

export async function savePortfolioForViewer(
  positions: PersistedPosition[],
  authenticated: boolean,
): Promise<PersistedPosition[]> {
  const trimmed = positions.slice(0, 50);
  if (!authenticated) {
    savePositions(trimmed);
    return trimmed;
  }

  const response = await fetch("/api/portfolio", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions: trimmed }),
  });
  if (!response.ok) throw new Error("Could not save the synced portfolio");
  const data = await response.json() as { positions?: PersistedPosition[] };
  return data.positions ?? trimmed;
}

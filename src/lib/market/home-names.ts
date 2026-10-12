import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { loadPositions } from "@/lib/portfolio/persist";

export type HomeNames = { held: string[]; watched: string[]; portfolioError: boolean; watchlistError: boolean };
type SavedNames = { authenticated: boolean; persistence?: string; positions?: Array<{ ticker: string }>; entries?: Array<{ ticker: string }> };

/** Only an explicit guest response permits browser-local data. Empty accounts stay empty. */
export function resolveNames(payload: SavedNames, kind: "positions" | "entries", local: () => string[]): string[] {
  if (payload.authenticated === false) return local();
  if (payload.authenticated !== true || payload.persistence === "unconfigured" || !Array.isArray(payload[kind])) throw new Error("Saved names unavailable");
  return payload[kind]!.map((entry) => entry.ticker.toUpperCase());
}

function browserWatchlist(): string[] {
  const value = JSON.parse(localStorage.getItem("conviction-watchlist") ?? "[]");
  if (!Array.isArray(value)) throw new Error("Invalid watchlist");
  return value.flatMap((entry) => typeof entry?.ticker === "string" ? [entry.ticker.toUpperCase()] : []);
}

export async function loadHomeNames(signal: AbortSignal): Promise<HomeNames> {
  const [held, watched] = await Promise.allSettled([
    fetchJsonWithTimeout<SavedNames>("/api/portfolio", 8000, signal)
      .then((data) => resolveNames(data, "positions", () => loadPositions().map((p) => p.ticker))),
    fetchJsonWithTimeout<SavedNames>("/api/watchlist", 8000, signal)
      .then((data) => resolveNames(data, "entries", browserWatchlist)),
  ]);
  return {
    held: held.status === "fulfilled" ? held.value : [],
    watched: watched.status === "fulfilled" ? watched.value : [],
    portfolioError: held.status === "rejected",
    watchlistError: watched.status === "rejected",
  };
}

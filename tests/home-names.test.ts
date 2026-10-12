import { afterEach, describe, expect, it, vi } from "vitest";
import { loadHomeNames, resolveNames } from "@/lib/market/home-names";
import { yieldStatus } from "@/lib/market/pulse-gauges";

afterEach(() => vi.unstubAllGlobals());
describe("Home personal data ownership", () => {
  it("does not resurrect browser holdings for an empty account", () => {
    const local = vi.fn(() => ["OLD"]);
    expect(resolveNames({ authenticated: true, positions: [] }, "positions", local)).toEqual([]);
    expect(local).not.toHaveBeenCalled();
  });
  it("uses local names only for an explicit guest", () => {
    expect(resolveNames({ authenticated: false }, "entries", () => ["AAPL"])).toEqual(["AAPL"]);
    expect(() => resolveNames({} as never, "entries", () => ["OLD"])).toThrow();
    expect(() => resolveNames({ authenticated: true, persistence: "unconfigured", entries: [] }, "entries", () => ["OLD"])).toThrow();
  });
  it("preserves successful holdings and flags a failed watchlist", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/portfolio"
      ? { ok: true, json: async () => ({ authenticated: true, positions: [{ ticker: "aapl" }] }) }
      : { ok: false, status: 503 }));
    expect(await loadHomeNames(new AbortController().signal)).toEqual({
      held: ["AAPL"], watched: [], portfolioError: false, watchlistError: true,
    });
  });
  it("does not turn an outage into a ready empty account", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await loadHomeNames(new AbortController().signal)).toEqual({
      held: [], watched: [], portfolioError: true, watchlistError: true,
    });
  });
  it("does not infer stable yields from missing change data", () => {
    expect(yieldStatus(null)).toEqual({ status: "CHANGE UNAVAILABLE", tone: "quiet" });
    expect(yieldStatus(0)).toEqual({ status: "STEADY", tone: "steady" });
  });
});

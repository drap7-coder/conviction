import { describe, expect, it, vi } from "vitest";
import { createBriefLoader, BRIEF_CACHE_MS, type BriefNews } from "../src/lib/watchlist/brief-coverage";
import { briefNames } from "../src/lib/watchlist/daily-brief";

const signal = () => new AbortController().signal;
const empty: BriefNews = { status: "empty", events: [] };

describe("brief coverage trust", () => {
  it("extends beyond six names without refetching cached coverage", async () => {
    let clock = 1000;
    const request = vi.fn(async () => empty);
    const loader = createBriefLoader(request, () => clock);
    const names = briefNames([], ["A", "B", "C", "D", "E", "F", "G"]);
    await loader.load(names.slice(0, 6), signal());
    clock = 2000;
    const result = await loader.load(names, signal());
    expect(request).toHaveBeenCalledTimes(7);
    expect(result.checked).toHaveLength(7);
    expect(result.fetchedAt).toBe(1000); // Never relabel old cache as fresh.
    expect(result.failed).toEqual([]);
  });

  it("reports unavailable names separately from successful empty coverage", async () => {
    const loader = createBriefLoader(async (ticker) => ticker === "A" ? empty : { status: "error", events: [] });
    const result = await loader.load(briefNames([], ["A", "B"]), signal());
    expect(result.checked).toEqual(["A"]);
    expect(result.failed).toEqual(["B"]);
    expect(result.stories).toEqual([]);
  });

  it("refreshes explicitly and expires cache after 15 minutes", async () => {
    let clock = 1000;
    const request = vi.fn(async () => empty);
    const loader = createBriefLoader(request, () => clock);
    const names = briefNames([], ["A"]);
    await loader.load(names, signal());
    loader.invalidate(["A"]);
    await loader.load(names, signal());
    clock += BRIEF_CACHE_MS;
    await loader.load(names, signal());
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("runs no more than two requests concurrently", async () => {
    let active = 0;
    let peak = 0;
    const loader = createBriefLoader(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      return empty;
    });
    await loader.load(briefNames([], ["A", "B", "C", "D", "E", "F", "G"]), signal());
    expect(peak).toBe(2);
  });

  it("does not start requests or publish coverage after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    const request = vi.fn(async () => empty);
    await expect(createBriefLoader(request).load(briefNames([], ["A"]), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
    expect(request).not.toHaveBeenCalled();
  });
});

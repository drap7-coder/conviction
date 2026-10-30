import { describe, expect, it } from "vitest";
import { dateWindow, normalizeNasdaqEarnings, upcomingOfficialEvents } from "@/lib/portfolio/event-calendar";

describe("portfolio event calendar", () => {
  it("returns only future official events in chronological order", () => {
    const events = upcomingOfficialEvents(new Date("2026-10-29T12:00:00-04:00"), 3);
    expect(events.map((event) => event.id)).toEqual(["eci-2026-10-30", "jobs-2026-11-06", "cpi-2026-11-10"]);
  });

  it("normalizes provider timing without inventing an exact report time", () => {
    const events = normalizeNasdaqEarnings([{ symbol: " aapl ", time: "time-after-hours" }, { symbol: "MSFT", time: "time-not-supplied" }], "2026-10-29");
    expect(events[0]).toMatchObject({ ticker: "AAPL", timing: "After close", kind: "earnings" });
    expect(events[1]).toMatchObject({ ticker: "MSFT", timing: "Time not supplied" });
  });

  it("builds an inclusive rolling date window", () => {
    expect(dateWindow(new Date("2026-10-29T12:00:00Z"), 2)).toEqual(["2026-10-29", "2026-10-30", "2026-10-31"]);
  });
});

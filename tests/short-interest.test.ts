import { afterEach, describe, expect, it, vi } from "vitest";
import { clearShortInterestCache, fetchShortInterestSummary } from "@/lib/market/short-interest";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("short interest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    clearShortInterestCache();
  });

  it("fetches latest FINRA short interest by settlement date", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/partitions/")) {
        return jsonResponse({
          availablePartitions: [
            { partitions: ["2026-06-30"] },
            { partitions: ["2026-06-15"] },
          ],
        });
      }

      const body = JSON.parse(String(init?.body));
      const settlementDate = body.compareFilters.find((filter: { fieldName: string }) => filter.fieldName === "settlementDate").fieldValue;
      return jsonResponse([{
        symbolCode: "OXY",
        issueName: "Occidental Petroleum",
        settlementDate,
        currentShortPositionQuantity: settlementDate === "2026-06-30" ? 26_337_816 : 27_260_783,
        previousShortPositionQuantity: settlementDate === "2026-06-30" ? 27_260_783 : 33_405_499,
        changePreviousNumber: settlementDate === "2026-06-30" ? -922_967 : -6_144_716,
        changePercent: settlementDate === "2026-06-30" ? -3.39 : -18.39,
        averageDailyVolumeQuantity: 9_888_486,
        daysToCoverQuantity: 2.66,
        marketClassCode: "NYSE",
      }]);
    }) as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const summary = await fetchShortInterestSummary("oxy");

    expect(summary.status).toBe("success");
    expect(summary.latest?.ticker).toBe("OXY");
    expect(summary.latest?.settlementDate).toBe("2026-06-30");
    expect(summary.latest?.currentShortShares).toBe(26_337_816);
    expect(summary.latest?.changePercent).toBe(-3.39);
    expect(summary.previous?.settlementDate).toBe("2026-06-15");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("returns empty when FINRA has no row for the ticker", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/partitions/")) {
        return jsonResponse({ availablePartitions: [{ partitions: ["2026-06-30"] }] });
      }
      return jsonResponse([]);
    }) as typeof fetch);

    const summary = await fetchShortInterestSummary("ZZZZ");

    expect(summary.status).toBe("empty");
    expect(summary.latest).toBeNull();
    expect(summary.previous).toBeNull();
  });
});

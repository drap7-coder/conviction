import { beforeEach, describe, expect, it, vi } from "vitest";

const count = vi.hoisted(() => vi.fn());
vi.mock("@/lib/product-event-store", () => ({ countProductEvent: count }));
vi.mock("@/lib/db", () => ({ isDatabaseConfigured: () => true }));
import { POST } from "@/app/api/analytics/events/route";

function request(body: unknown, origin = "https://iqbulls.com") {
  return new Request("https://iqbulls.com/api/analytics/events", {
    method: "POST",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("product milestone collection", () => {
  beforeEach(() => count.mockReset());
  it("rejects cross-origin requests before writing", async () => {
    expect((await POST(request({ event: "portfolio_created" }, "https://elsewhere.test"))).status).toBe(403);
    expect(count).not.toHaveBeenCalled();
  });
  it("rejects arbitrary event names", async () => {
    expect((await POST(request({ event: "private_financial_details" }))).status).toBe(400);
    expect(count).not.toHaveBeenCalled();
  });
  it("counts only the approved milestone, ignoring supplied properties", async () => {
    expect((await POST(request({ event: "portfolio_created", shares: 10, ticker: "AAPL" }))).status).toBe(204);
    expect(count).toHaveBeenCalledExactlyOnceWith("portfolio_created");
  });
  it("reports storage failure without pretending collection succeeded", async () => {
    count.mockRejectedValueOnce(new Error("offline"));
    expect((await POST(request({ event: "search_submitted" }))).status).toBe(503);
  });
});

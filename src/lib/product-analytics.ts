export const PRODUCT_EVENTS = ["search_submitted", "movers_opened", "portfolio_setup_started", "portfolio_created", "holding_added", "return_visit"] as const;
export type ProductEvent = typeof PRODUCT_EVENTS[number];

// Milestones only: never attach financial details, search terms, or identity.
export function trackProductEvent(event: ProductEvent) {
  if (typeof window === "undefined" || navigator.doNotTrack === "1") return;
  try {
    void fetch("/api/analytics/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Measurement must never interrupt the product.
  }
}

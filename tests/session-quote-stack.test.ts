import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SessionQuoteStack } from "@/components/market/SessionQuoteStack";

describe("SessionQuoteStack", () => {
  it("does not re-promote a mover row whose active extended print is already primary", () => {
    const html = renderToStaticMarkup(createElement(SessionQuoteStack, {
      lastPrice: 16.52,
      change: -0.2,
      changePercent: -1.22,
      extendedLabel: "After Hours",
      extendedPrice: 16.72,
      extendedChange: 1.17,
      extendedChangePercent: 7.52,
      priorCloseSecondary: true,
      activeSessionPrimary: true,
    }));

    expect(html).toContain("$16.52");
    expect(html).toContain("−$0.20");
    expect(html).toContain("-1.22%");
    expect(html).toContain("$16.72");
    expect(html).toContain("+$1.17");
    expect(html).toContain("+7.52%");
    expect(html.indexOf("-1.22%")).toBeLessThan(html.indexOf("+7.52%"));
  });
});

/**
 * ── Tests for Display Layer ──
 *
 * Covers formatting utilities and quote freshness.
 */

import { describe, it, expect } from "vitest";
import {
  isFiniteNumber,
  fmtCurrency,
  fmtCompactCurrency,
  fmtPercent,
  fmtPrice,
  fmtSignedDollar,
  fmtMarketCap,
  fmtDate,
  classifyFreshness,
} from "@/lib/display/format";

// ═══════════════════════════════════════════════════════════════
// Formatting utilities
// ═══════════════════════════════════════════════════════════════

describe("isFiniteNumber", () => {
  it("returns true for finite numbers", () => {
    expect(isFiniteNumber(0)).toBe(true);
    expect(isFiniteNumber(42)).toBe(true);
    expect(isFiniteNumber(-3.14)).toBe(true);
  });

  it("returns false for null", () => {
    expect(isFiniteNumber(null)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isFiniteNumber(NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber(-Infinity)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isFiniteNumber(undefined)).toBe(false);
  });
});

describe("fmtCurrency", () => {
  it("formats a value as USD", () => {
    expect(fmtCurrency(1234.5)).toBe("$1,234.50");
  });

  it("returns — for null", () => {
    expect(fmtCurrency(null)).toBe("—");
  });

  it("returns — for NaN", () => {
    expect(fmtCurrency(NaN)).toBe("—");
  });
});

describe("fmtCompactCurrency", () => {
  it("formats billions", () => {
    expect(fmtCompactCurrency(1_500_000_000)).toBe("$1.5B");
  });

  it("formats millions", () => {
    expect(fmtCompactCurrency(2_300_000)).toBe("$2.3M");
  });

  it("formats thousands", () => {
    expect(fmtCompactCurrency(450_000)).toBe("$450.0K");
  });

  it("formats small values with decimals", () => {
    expect(fmtCompactCurrency(123.45)).toBe("$123.45");
  });

  it("returns — for null", () => {
    expect(fmtCompactCurrency(null)).toBe("—");
  });
});

describe("fmtPercent", () => {
  it("formats a positive percentage", () => {
    expect(fmtPercent(3.42)).toBe("+3.42%");
  });

  it("formats a negative percentage", () => {
    expect(fmtPercent(-0.15)).toBe("-0.15%");
  });

  it("formats zero", () => {
    expect(fmtPercent(0)).toBe("+0.00%");
  });

  it("returns — for null", () => {
    expect(fmtPercent(null)).toBe("—");
  });

  it("respects decimal places", () => {
    expect(fmtPercent(3.456, 1)).toBe("+3.5%");
  });
});

describe("fmtPrice", () => {
  it("formats high values without decimals", () => {
    expect(fmtPrice(5469)).toBe("5,469");
  });

  it("formats medium values with 2 decimals", () => {
    expect(fmtPrice(150.25)).toBe("150.25");
  });

  it("formats small values with 3 decimals", () => {
    expect(fmtPrice(0.123)).toBe("0.123");
  });

  it("returns — for null", () => {
    expect(fmtPrice(null)).toBe("—");
  });
});

describe("fmtSignedDollar", () => {
  it("formats a positive value", () => {
    expect(fmtSignedDollar(420.69)).toBe("+$420.69");
  });

  it("formats a negative value", () => {
    expect(fmtSignedDollar(-50)).toBe("−$50.00");
  });

  it("formats zero", () => {
    expect(fmtSignedDollar(0)).toBe("$0.00");
  });

  it("returns — for null", () => {
    expect(fmtSignedDollar(null)).toBe("—");
  });
});

describe("fmtMarketCap", () => {
  it("formats billions", () => {
    expect(fmtMarketCap(185_200_000_000)).toBe("$185.2B");
  });

  it("formats millions", () => {
    expect(fmtMarketCap(12_400_000)).toBe("$12.4M");
  });

  it("returns — for null", () => {
    expect(fmtMarketCap(null)).toBe("—");
  });
});

describe("fmtDate", () => {
  it("returns 'today' for current date", () => {
    expect(fmtDate(new Date().toISOString())).toBe("today");
  });

  it("returns '—' for null", () => {
    expect(fmtDate(null)).toBe("—");
  });

  it("returns '—' for invalid date", () => {
    expect(fmtDate("not-a-date")).toBe("—");
  });
});

// ═══════════════════════════════════════════════════════════════
// Quote freshness classification
// ═══════════════════════════════════════════════════════════════

describe("classifyFreshness", () => {
  it("classifies live data within 60s", () => {
    const now = new Date().toISOString();
    expect(classifyFreshness(now)).toBe("live");
  });

  it("classifies recent data within 5m", () => {
    const fiveMinAgo = new Date(Date.now() - 120_000).toISOString();
    expect(classifyFreshness(fiveMinAgo)).toBe("recent");
  });

  it("classifies stale data older than 15m", () => {
    const old = new Date(Date.now() - 1_000_000).toISOString();
    expect(classifyFreshness(old)).toBe("stale");
  });

  it("returns 'unavailable' for null", () => {
    expect(classifyFreshness(null)).toBe("unavailable");
  });

  it("returns 'delayed' for explicit delayed provider", () => {
    expect(classifyFreshness(new Date().toISOString(), true)).toBe("delayed");
  });
});

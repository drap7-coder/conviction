/**
 * Pure vector resolvers for the Multi-Vector Summary.
 *
 * Each function accepts only normalized, already-fetched evidence inputs.
 * No I/O, no React, no environment variables — deterministic only.
 */

// ── ETF allowlist ──────────────────────────────────────────────────────────
// Documented limitation: ETF classification uses a hardcoded ticker set.
// A reliable general ETF flag does not exist in the current data model.
export const ETF_TICKERS = new Set(["QQQ", "SCHD", "VWO"]);

// ── Shared types ──────────────────────────────────────────────────────────

export type VectorState =
  | "strong"
  | "mixed"
  | "weak"
  | "awaiting"
  | "unsupported"
  | "error";

export interface VectorResult {
  state: VectorState;
  label: string;
  reason: string;
  asOf: string | null;
  sourceCount: number;
}

// ── Input types ───────────────────────────────────────────────────────────

export interface OwnershipInputInstitutional {
  status: "New" | "Increased" | "Unchanged" | "Reduced" | "Exited";
  filingDate: string;
  shareChange: number;
}

export interface OwnershipInputInsider {
  /** "purchase" or "sale" */
  transactionType: string | null | undefined;
  date: string;
}

export interface OwnershipInput {
  isEft: boolean;
  /** Tracked-manager 13F accumulation data */
  institutional: OwnershipInputInstitutional[] | null;
  /** Insider open-market transactions */
  insider: OwnershipInputInsider[] | null;
  /** "success" | "timeout" | "error" | "empty" etc. */
  institutionalStatus: string | null;
  insiderStatus: string | null;
}

export interface FundamentalsInput {
  isEft: boolean;
  /** Earnings beat/miss events (from move-events or dedicated source) */
  earnings: unknown[] | null;
  /** Guidance revision events */
  guidance: unknown[] | null;
  earningsStatus: string | null;
  guidanceStatus: string | null;
}

export interface PriceInput {
  currentPrice: number | null;
  sma50: number | null;
  sma200: number | null;
  priceStatus: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function latestFilingDate(
  items: { filingDate?: string; date?: string }[],
): string | null {
  const dates = items
    .map((i) => i.filingDate ?? i.date)
    .filter(Boolean) as string[];
  if (dates.length === 0) return null;
  return dates.sort((a, b) => b.localeCompare(a))[0];
}

// ── Ownership vector ──────────────────────────────────────────────────────

export function resolveOwnershipVector(
  input: OwnershipInput,
): VectorResult {
  // Unsupported for ETFs
  if (input.isEft) {
    return {
      state: "unsupported",
      label: "Ownership",
      reason: "ETF — ownership analysis does not apply.",
      asOf: null,
      sourceCount: 0,
    };
  }

  // Error states
  const instErr =
    input.institutionalStatus === "timeout" ||
    input.institutionalStatus === "error";
  const insiderErr =
    input.insiderStatus === "timeout" || input.insiderStatus === "error";

  // Both errored
  if (instErr && insiderErr) {
    return {
      state: "error",
      label: "Ownership",
      reason: "Source data is temporarily unavailable.",
      asOf: null,
      sourceCount: 0,
    };
  }

  // One errored, other missing
  if (instErr && !input.institutional) {
    return {
      state: "awaiting",
      label: "Ownership",
      reason: "Institutional data is temporarily unavailable.",
      asOf: null,
      sourceCount: 0,
    };
  }
  if (insiderErr && !input.insider) {
    return {
      state: "awaiting",
      label: "Ownership",
      reason: "Insider data is temporarily unavailable.",
      asOf: null,
      sourceCount: 0,
    };
  }

  const inst = input.institutional ?? [];
  const insider = input.insider ?? [];

  // Both empty — awaiting (ownership analysis applies but data hasn't loaded)
  if (inst.length === 0 && insider.length === 0) {
    return {
      state: "awaiting",
      label: "Ownership",
      reason: "No institutional or insider evidence loaded yet.",
      asOf: null,
      sourceCount: 0,
    };
  }

  // Count positive and negative signals
  const activeInst = inst.filter((i) => i.status !== "Unchanged");
  const instBuys = activeInst.filter(
    (i) => i.status === "New" || i.status === "Increased",
  );
  const instSells = activeInst.filter(
    (i) => i.status === "Reduced" || i.status === "Exited",
  );

  const insiderBuys = insider.filter(
    (i) => i.transactionType === "purchase",
  );
  const insiderSells = insider.filter(
    (i) => i.transactionType === "sale",
  );

  // Note: absence of insider activity is NOT negative evidence
  const totalPositive = instBuys.length;
  const totalNegative = instSells.length;

  // As-of date from most recent filing
  const allDates = [...inst.map((i) => i.filingDate), ...insider.map((i) => i.date)];
  const asOf = latestFilingDate(
    allDates
      .filter(Boolean)
      .map((d) => ({ date: d! })),
  );

  if (totalPositive > 0 && totalNegative === 0) {
    return {
      state: "strong",
      label: "Ownership",
      reason: `${instBuys.length} tracked manager${instBuys.length === 1 ? "" : "s"} accumulating.`,
      asOf,
      sourceCount: totalPositive,
    };
  }

  if (totalPositive > 0 && totalNegative > 0) {
    const ratio = totalPositive / (totalPositive + totalNegative);
    if (ratio >= 0.6) {
      return {
        state: "strong",
        label: "Ownership",
        reason: `Net positive: ${totalPositive} accumulating, ${totalNegative} reducing.`,
        asOf,
        sourceCount: totalPositive + totalNegative,
      };
    }
    return {
      state: "mixed",
      label: "Ownership",
      reason: `Mixed: ${totalPositive} accumulating, ${totalNegative} reducing.`,
      asOf,
      sourceCount: totalPositive + totalNegative,
    };
  }

  if (totalPositive === 0 && totalNegative > 0) {
    return {
      state: "weak",
      label: "Ownership",
      reason: `${instSells.length} tracked manager${instSells.length === 1 ? "" : "s"} reducing exposure.`,
      asOf,
      sourceCount: totalNegative,
    };
  }

  // Institutional flat, no insider activity
  return {
    state: "awaiting",
    label: "Ownership",
    reason: "No material ownership change detected.",
    asOf,
    sourceCount: 0,
  };
}

// ── Fundamentals vector ────────────────────────────────────────────────────

export function resolveFundamentalsVector(
  input: FundamentalsInput,
): VectorResult {
  // Unsupported for ETFs
  if (input.isEft) {
    return {
      state: "unsupported",
      label: "Fundamentals",
      reason: "ETF — fundamentals analysis does not apply.",
      asOf: null,
      sourceCount: 0,
    };
  }

  // Check for error states
  const earningsErr =
    input.earningsStatus === "timeout" || input.earningsStatus === "error";
  const guidanceErr =
    input.guidanceStatus === "timeout" || input.guidanceStatus === "error";

  if (earningsErr && guidanceErr) {
    return {
      state: "error",
      label: "Fundamentals",
      reason: "Source data is temporarily unavailable.",
      asOf: null,
      sourceCount: 0,
    };
  }

  // Missing data: the page does not fetch dedicated earnings/guidance endpoints
  const earnings = input.earnings ?? [];
  const guidance = input.guidance ?? [];

  if (earnings.length === 0 && guidance.length === 0) {
    return {
      state: "awaiting",
      label: "Fundamentals",
      reason: "No earnings or guidance evidence loaded yet.",
      asOf: null,
      sourceCount: 0,
    };
  }

  return {
    state: "awaiting",
    label: "Fundamentals",
    reason: `${earnings.length} earnings event${earnings.length === 1 ? "" : "s"} available.`,
    asOf: null,
    sourceCount: earnings.length + guidance.length,
  };
}

// ── Price vector ──────────────────────────────────────────────────────────

export function resolvePriceVector(input: PriceInput): VectorResult {
  // Error
  if (input.priceStatus === "error" || input.priceStatus === "timeout") {
    return {
      state: "error",
      label: "Price",
      reason: "Market data is temporarily unavailable.",
      asOf: null,
      sourceCount: 0,
    };
  }

  // No data
  if (input.currentPrice === null) {
    return {
      state: "awaiting",
      label: "Price",
      reason: "Price data has not loaded yet.",
      asOf: null,
      sourceCount: 0,
    };
  }

  const sma50 = input.sma50;
  const sma200 = input.sma200;

  // Not enough history for SMAs
  if (sma50 === null || sma200 === null) {
    return {
      state: "awaiting",
      label: "Price",
      reason: "Insufficient trading history for trend analysis.",
      asOf: null,
      sourceCount: 1,
    };
  }

  const price = input.currentPrice;
  const above50 = price > sma50;
  const above200 = price > sma200;
  const bullOrder = sma50 >= sma200;

  if (above50 && above200 && bullOrder) {
    return {
      state: "strong",
      label: "Price",
      reason: "Price above both moving averages with bullish slope.",
      asOf: null,
      sourceCount: 1,
    };
  }

  if (!above50 && !above200 && !bullOrder) {
    return {
      state: "weak",
      label: "Price",
      reason: "Price below both moving averages with bearish slope.",
      asOf: null,
      sourceCount: 1,
    };
  }

  return {
    state: "mixed",
    label: "Price",
    reason: above50
      ? "Price above SMA-50 but mixed relative to SMA-200."
      : "Price below SMA-50 but mixed relative to SMA-200.",
    asOf: null,
    sourceCount: 1,
  };
}

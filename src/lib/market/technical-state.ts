export interface StockHistoryPoint {
  date: string;
  close: number;
}

export interface TechnicalState {
  /** Short human-readable label */
  label: string;
  /** One-sentence interpretation */
  interpretation: string;
  /** SMA-50 value (null if insufficient data) */
  sma50: number | null;
  /** SMA-200 value (null if insufficient data) */
  sma200: number | null;
  /** Price relation to SMA-50 */
  sma50Relation: "above" | "below" | "equal" | null;
  /** Price relation to SMA-200 */
  sma200Relation: "above" | "below" | "equal" | null;
  /** Percentage delta from current price to SMA-50 */
  sma50Delta: number | null;
  /** Percentage delta from current price to SMA-200 */
  sma200Delta: number | null;
  /** Whether SMA-50 has crossed SMA-200 */
  smaCrossRelation: "golden-cross" | "death-cross" | "above" | "below" | "equal" | null;
  /** 0–100 percentile within 52-week range */
  fiftyTwoWeekPercentile: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  /** Short-term trend: % change over last 5 trading days */
  shortTermTrend: number | null;
}

/**
 * Calculate a simple moving average for a given period.
 * Returns an array the same length as `closes`; leading entries
 * before the window fills are null.
 */
export function computeSma(
  closes: number[],
  period: number,
): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) {
        sum += closes[j];
      }
      result.push(sum / period);
    }
  }
  return result;
}

/**
 * Derive the current technical state from a history of daily price points.
 * Uses the latest values for SMA-50, SMA-200, and price.
 */
export function deriveTechnicalState(
  points: StockHistoryPoint[],
  currentPrice: number | null,
  fiftyTwoWeekHigh: number | null,
  fiftyTwoWeekLow: number | null,
): TechnicalState {
  const closes = points.map((p) => p.close);
  const latestPrice = currentPrice ?? closes[closes.length - 1] ?? null;

  if (closes.length === 0 || latestPrice === null) {
    return {
      label: "Insufficient Data",
      interpretation: "Not enough trading history to establish a technical baseline.",
      sma50: null,
      sma200: null,
      sma50Relation: null,
      sma200Relation: null,
      sma50Delta: null,
      sma200Delta: null,
      smaCrossRelation: null,
      fiftyTwoWeekPercentile: null,
      fiftyTwoWeekHigh: fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: fiftyTwoWeekLow ?? null,
      shortTermTrend: null,
    };
  }

  const sma50Values = computeSma(closes, 50);
  const sma200Values = computeSma(closes, 200);

  const sma50 = sma50Values[sma50Values.length - 1] ?? null;
  const sma200 = sma200Values[sma200Values.length - 1] ?? null;

  const sma50Relation =
    sma50 !== null
      ? latestPrice > sma50
        ? "above"
        : latestPrice < sma50
          ? "below"
          : "equal"
      : null;

  const sma200Relation =
    sma200 !== null
      ? latestPrice > sma200
        ? "above"
        : latestPrice < sma200
          ? "below"
          : "equal"
      : null;

  // Cross relation: compare last non-null SMA-50 and SMA-200 values
  let smaCrossRelation: TechnicalState["smaCrossRelation"] = null;
  if (sma50 !== null && sma200 !== null) {
    if (sma50 > sma200) {
      // Check if there was a recent cross (last 5 periods where SMA-50 was below SMA-200)
      let recentCross = false;
      for (let i = Math.max(0, closes.length - 10); i < closes.length; i++) {
        const s50 = sma50Values[i];
        const s200 = sma200Values[i];
        if (s50 !== null && s200 !== null && s50 <= s200) {
          recentCross = true;
          break;
        }
      }
      smaCrossRelation = recentCross ? "golden-cross" : "above";
    } else if (sma50 < sma200) {
      let recentCross = false;
      for (let i = Math.max(0, closes.length - 10); i < closes.length; i++) {
        const s50 = sma50Values[i];
        const s200 = sma200Values[i];
        if (s50 !== null && s200 !== null && s50 >= s200) {
          recentCross = true;
          break;
        }
      }
      smaCrossRelation = recentCross ? "death-cross" : "below";
    } else {
      smaCrossRelation = "equal";
    }
  }

  // SMA deltas: percentage difference from price to SMA
  const sma50Delta = sma50 !== null && latestPrice !== null
    ? ((latestPrice - sma50) / sma50) * 100
    : null;
  const sma200Delta = sma200 !== null && latestPrice !== null
    ? ((latestPrice - sma200) / sma200) * 100
    : null;

  // Short-term trend: % change over last 5 trading days
  let shortTermTrend: number | null = null;
  if (closes.length >= 6) {
    shortTermTrend = ((closes[closes.length - 1] - closes[closes.length - 6]) / closes[closes.length - 6]) * 100;
  } else if (closes.length >= 2) {
    shortTermTrend = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100;
  }

  // Determine state label + interpretation
  let label: string;
  let interpretation: string;

  if (sma50 === null && sma200 === null) {
    label = "Insufficient Data";
    interpretation = "Not enough trading history to establish a technical baseline.";
  } else if (sma50Relation === "above" && sma200Relation === "above") {
    if (smaCrossRelation === "golden-cross") {
      label = "Golden Cross";
      interpretation = "Short-term trend has crossed above long-term trend, signaling bullish momentum shift.";
    } else {
      label = "Trend Resisting";
      interpretation = "Price is above both short-term and long-term moving averages. Momentum favors upside.";
    }
  } else if (sma50Relation === "above" && sma200Relation === "below") {
    label = "Recovering";
    interpretation = "Short-term momentum has turned positive, but price remains below the long-term trend line.";
  } else if (sma50Relation === "below" && sma200Relation === "above") {
    label = "Weakening";
    interpretation = "Price has fallen below the short-term average while staying above the long-term trend. Caution warranted.";
  } else if (sma50Relation === "below" && sma200Relation === "below") {
    if (smaCrossRelation === "death-cross") {
      label = "Death Cross";
      interpretation = "Short-term trend has crossed below long-term trend, signaling bearish momentum shift.";
    } else {
      label = "Trend Lagging";
      interpretation = "Price is below both short-term and long-term moving averages. Downside momentum persists.";
      if (shortTermTrend !== null && shortTermTrend > 0.5) {
        interpretation += ` But short-term trend shows +${shortTermTrend.toFixed(1)}% over the last 5 trading days.`;
      } else if (shortTermTrend !== null && shortTermTrend < -0.5) {
        interpretation += ` Short-term trend confirms downside with ${shortTermTrend.toFixed(1)}% over the last 5 days.`;
      }
    }
  } else {
    label = "Mixed Signal";
    interpretation = "Price is near key moving average thresholds. Direction not firmly established.";
  }

  // 52-week percentile
  let fiftyTwoWeekPercentile: number | null = null;
  if (fiftyTwoWeekHigh !== null && fiftyTwoWeekLow !== null && fiftyTwoWeekHigh !== fiftyTwoWeekLow) {
    fiftyTwoWeekPercentile =
      ((latestPrice - fiftyTwoWeekLow) / (fiftyTwoWeekHigh - fiftyTwoWeekLow)) * 100;
    fiftyTwoWeekPercentile = Math.max(0, Math.min(100, fiftyTwoWeekPercentile));
  }

  return {
    label,
    interpretation,
    sma50,
    sma200,
    sma50Relation,
    sma200Relation,
    sma50Delta,
    sma200Delta,
    smaCrossRelation,
    fiftyTwoWeekPercentile,
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    shortTermTrend,
  };
}

/**
 * Build SVG path data for an SMA line, aligned with the chart coordinate system.
 * Returns empty string for insufficient data.
 */
export function buildSmaPath(
  closes: number[],
  smaValues: (number | null)[],
  width: number,
  height: number,
  padding: number,
): string {
  const nonNullSma: number[] = [];
  const nonNullIndices: number[] = [];
  for (let i = 0; i < smaValues.length; i++) {
    if (smaValues[i] !== null) {
      nonNullSma.push(smaValues[i]!);
      nonNullIndices.push(i);
    }
  }

  if (nonNullSma.length < 2) return "";

  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const spread = max - min || 1;

  const totalPoints = smaValues.length;

  return nonNullIndices
    .map((index) => {
      const x = padding + (index / (totalPoints - 1)) * (width - padding * 2);
      const y = padding + ((max - smaValues[index]!) / spread) * (height - padding * 2);
      return `${index === nonNullIndices[0] ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}
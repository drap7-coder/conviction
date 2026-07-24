/**
 * ── Macro Regime Engine ──
 *
 * Deterministic, rules-based market regime classification.
 * No opaque scores, no AI, no predictions.
 * Uses only available indicator data. When inputs are missing,
 * the regime label reflects that limitation.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type MacroRegimeLabel =
  | "Risk-on"
  | "Risk-off"
  | "Defensive rotation"
  | "Growth-led"
  | "Cyclical rotation"
  | "Volatility expansion"
  | "Volatility compression"
  | "Rates pressure"
  | "Mixed signals"
  | "Insufficient data";

export type Confidence = "high" | "medium" | "low";

export type DriverDirection = "rising" | "falling" | "flat" | "mixed" | "unavailable";

export type DriverId = "rates" | "volatility" | "oil" | "dollar" | "equities";

export interface MacroDriverInsight {
  id: DriverId;
  label: string;
  direction: DriverDirection;
  significance: "high" | "medium" | "low";
  explanation: string;
}

export interface MacroRegime {
  label: MacroRegimeLabel;
  confidence: Confidence;
  summary: string;
  drivers: MacroDriverInsight[];
  missingInputs: string[];
}

// ── Normalized indicator input ──

export interface IndicatorSnapshot {
  ticker: string;
  label: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  isPercentValue: boolean;
  status: "ready" | "proxy" | "delayed" | "stale" | "unsupported" | "error";
}

// ── Direction helpers ──

function direction(
  changePercent: number | null,
  threshold: number = 0.3,
): DriverDirection {
  if (changePercent === null) return "unavailable";
  if (changePercent > threshold) return "rising";
  if (changePercent < -threshold) return "falling";
  return "flat";
}

function significance(
  changePercent: number | null,
  bigThreshold: number = 1,
): "high" | "medium" | "low" {
  if (changePercent === null) return "low";
  const abs = Math.abs(changePercent);
  if (abs > bigThreshold) return "high";
  if (abs > 0.3) return "medium";
  return "low";
}

// ── Regime classification ──

export function classifyMacroRegime(
  indicators: IndicatorSnapshot[],
): MacroRegime {
  const map = new Map(indicators.map((i) => [i.ticker, i]));

  const spy = map.get("SPY");
  const qqq = map.get("QQQ");
  const vix = map.get("^VIX");
  const tnx = map.get("^TNX");
  const uso = map.get("USO");
  const uup = map.get("UUP");

  const equitiesDir = direction(spy?.changePercent ?? null);
  const nasdaqDir = direction(qqq?.changePercent ?? null, 0.5);
  const vixDir = direction(vix?.changePercent ?? null, 2);
  const ratesDir = direction(tnx?.changePercent ?? null, 0.5);
  const oilDir = direction(uso?.changePercent ?? null, 0.5);
  const dollarDir = direction(uup?.changePercent ?? null, 0.3);

  // Build driver insights
  const drivers: MacroDriverInsight[] = [];

  if (equitiesDir !== "unavailable") {
    drivers.push({
      id: "equities",
      label: "Equities",
      direction: equitiesDir,
      significance: significance(spy?.changePercent ?? null, 0.5),
      explanation:
        equitiesDir === "rising"
          ? "Broad equity index is advancing."
          : equitiesDir === "falling"
            ? "Broad equity index is declining."
            : "Equity index is flat.",
    });
  }

  if (ratesDir !== "unavailable") {
    drivers.push({
      id: "rates",
      label: "10Y Yield",
      direction: ratesDir,
      significance: significance(tnx?.changePercent ?? null, 0.8),
      explanation:
        ratesDir === "rising"
          ? "Treasury yields are rising, which may pressure growth and duration-sensitive assets."
          : ratesDir === "falling"
            ? "Treasury yields are declining, which tends to support growth stocks and longer-duration assets."
            : "Yields are relatively stable.",
    });
  }

  if (vixDir !== "unavailable") {
    drivers.push({
      id: "volatility",
      label: "Volatility",
      direction: vixDir,
      significance: significance(vix?.changePercent ?? null, 5),
      explanation:
        vixDir === "rising"
          ? "Volatility is increasing, which may indicate heightened uncertainty or risk aversion."
          : vixDir === "falling"
            ? "Volatility is declining, which typically supports risk-on positioning."
            : "Volatility is stable.",
    });
  }

  if (oilDir !== "unavailable") {
    drivers.push({
      id: "oil",
      label: "Oil",
      direction: oilDir,
      significance: significance(uso?.changePercent ?? null, 1),
      explanation:
        oilDir === "rising"
          ? "Oil prices are rising, which may feed into input costs across transport and manufacturing."
          : oilDir === "falling"
            ? "Oil prices are declining, which may relieve margin pressure on energy-consuming sectors."
            : "Oil prices are stable.",
    });
  }

  if (dollarDir !== "unavailable") {
    drivers.push({
      id: "dollar",
      label: "Dollar",
      direction: dollarDir,
      significance: significance(uup?.changePercent ?? null, 0.5),
      explanation:
        dollarDir === "rising"
          ? "The dollar is strengthening, which may weigh on multinational earnings and commodities."
          : dollarDir === "falling"
            ? "The dollar is weakening, which may support commodities and international exposure."
            : "The dollar is stable.",
    });
  }

  const missingInputs = ["SPY", "QQQ", "^VIX", "^TNX", "USO", "UUP"]
    .filter((t) => {
      const ind = map.get(t);
      return !ind || ind.changePercent === null;
    })
    .map((t) => {
      const m: Record<string, string> = {
        SPY: "S&P 500",
        QQQ: "Nasdaq",
        "^VIX": "VIX",
        "^TNX": "10-year yield",
        USO: "Oil",
        UUP: "Dollar",
      };
      return m[t] ?? t;
    });

  // ── Classification logic ──

  // Check for insufficient data first
  const availableCount = drivers.length;
  if (availableCount <= 1) {
    return {
      label: "Insufficient data",
      confidence: "low",
      summary: "Too few market indicators are available to assess the macro regime.",
      drivers,
      missingInputs,
    };
  }

  const equitiesUp = equitiesDir === "rising";
  const equitiesDown = equitiesDir === "falling";
  const vixUp = vixDir === "rising";
  const vixDown = vixDir === "falling";
  const ratesUp = ratesDir === "rising";
  const ratesDown = ratesDir === "falling";
  const oilUp = oilDir === "rising";
  const oilDown = oilDir === "falling";

  // Risk-on: equities up, VIX down
  if (equitiesUp && vixDown) {
    if (ratesDown) {
      return {
        label: "Risk-on",
        confidence: "high",
        summary: "Equities are rising with declining volatility and falling yields. Conditions broadly support risk assets, particularly growth and duration-sensitive names.",
        drivers,
        missingInputs,
      };
    }
    if (ratesUp && oilUp) {
      return {
        label: "Cyclical rotation",
        confidence: "medium",
        summary: "Equities are rising despite rising yields and higher oil, suggesting a cyclical rotation toward value and commodity-sensitive sectors.",
        drivers,
        missingInputs,
      };
    }
    return {
      label: "Risk-on",
      confidence: "medium",
      summary: "Equities are advancing with declining volatility, supporting risk asset positioning.",
      drivers,
      missingInputs,
    };
  }

  // Risk-off: equities down, VIX up
  if (equitiesDown && vixUp) {
    return {
      label: "Risk-off",
      confidence: "high",
      summary: "Equities are declining with rising volatility, indicating broad risk aversion. Defensive positioning may be warranted.",
      drivers,
      missingInputs,
    };
  }

  // Growth-led: Nasdaq outperforming, rates flat or falling
  if (nasdaqDir === "rising" && equitiesUp && !ratesUp) {
    return {
      label: "Growth-led",
      confidence: "medium",
      summary: "Technology and growth names are leading the advance, supported by stable or falling yields.",
      drivers,
      missingInputs,
    };
  }

  // Defensive rotation: equities flat/down, defensives mentioned
  if (equitiesDown && !vixUp) {
    return {
      label: "Defensive rotation",
      confidence: "low",
      summary: "Equities are modestly lower without a spike in volatility. Sector leadership may be rotating toward defensive areas.",
      drivers,
      missingInputs,
    };
  }

  // Volatility expansion: VIX up significantly, equities mixed
  if (vixUp && !equitiesDown) {
    return {
      label: "Volatility expansion",
      confidence: "medium",
      summary: "Volatility is rising even as broad equity indexes hold. This divergence warrants attention — it may signal building stress beneath the surface.",
      drivers,
      missingInputs,
    };
  }

  // Volatility compression: VIX down, equities flat
  if (vixDown && !equitiesUp) {
    return {
      label: "Volatility compression",
      confidence: "low",
      summary: "Volatility is compressing while equities are range-bound. This is consistent with a low-conviction, waiting-for-catalyst environment.",
      drivers,
      missingInputs,
    };
  }

  // Rates pressure: yields up, equities mixed
  if (ratesUp && !equitiesUp) {
    return {
      label: "Rates pressure",
      confidence: "medium",
      summary: "Rising yields are not being matched by equity strength, suggesting rate-sensitive assets may be under pressure.",
      drivers,
      missingInputs,
    };
  }

  // Fallback: mixed signals
  return {
    label: "Mixed signals",
    confidence: "low",
    summary: "Market indicators are sending mixed or conflicting signals. No dominant macro regime is clearly identifiable.",
    drivers,
    missingInputs,
  };
}
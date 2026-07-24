/**
 * ── Sector Classification ──
 *
 * Static typed classification of sectors by economic characteristics.
 * Used to power sector leadership interpretation.
 */

export type SectorCharacteristic = "cyclical" | "defensive" | "growth-sensitive" | "rate-sensitive";

export const SECTOR_CHARACTERISTICS: Record<string, readonly SectorCharacteristic[]> = {
  Technology: ["growth-sensitive", "rate-sensitive"],
  "Communication Services": ["growth-sensitive"],
  "Consumer Discretionary": ["cyclical"],
  Financials: ["cyclical", "rate-sensitive"],
  Industrials: ["cyclical"],
  Materials: ["cyclical"],
  Energy: ["cyclical"],
  "Consumer Staples": ["defensive"],
  "Health Care": ["defensive"],
  Utilities: ["defensive", "rate-sensitive"],
  "Real Estate": ["rate-sensitive"],
} as const;

export interface SectorLeadership {
  leading: { name: string; changePercent: number | null }[];
  lagging: { name: string; changePercent: number | null }[];
  remaining: { name: string; changePercent: number | null }[];
  interpretation: string | null;
  characteristics: {
    cyclical: number[];
    defensive: number[];
    growthSensitive: number[];
    rateSensitive: number[];
  };
  missingCount: number;
}

/**
 * Classify sector performance into leaders, laggers, and interpret the
 * characteristic mix. Returns null interpretation when data is insufficient.
 */
export function classifySectorLeadership(
  sectors: { name: string; changePercent: number | null }[],
): SectorLeadership {
  const withData = sectors.filter((s) => s.changePercent !== null) as {
    name: string;
    changePercent: number;
  }[];
  const missingCount = sectors.length - withData.length;

  // Sort descending by changePercent
  withData.sort((a, b) => b.changePercent - a.changePercent);

  const count = withData.length;
  const splitPoint = Math.max(1, Math.ceil(count / 3));

  const leading = withData.slice(0, splitPoint).map((s) => ({ name: s.name, changePercent: s.changePercent }));
  const lagging = withData.slice(-splitPoint).map((s) => ({ name: s.name, changePercent: s.changePercent }));

  const leadingNames = new Set(leading.map((s) => s.name));
  const laggingNames = new Set(lagging.map((s) => s.name));
  const remaining = withData
    .filter((s) => !leadingNames.has(s.name) && !laggingNames.has(s.name))
    .map((s) => ({ name: s.name, changePercent: s.changePercent }));

  // Determine which characteristics are winning and losing
  const leadingChanges: number[] = leading.map((s) => s.changePercent);
  const laggingChanges: number[] = lagging.map((s) => s.changePercent);

  const characteristics = {
    cyclical: [] as number[],
    defensive: [] as number[],
    growthSensitive: [] as number[],
    rateSensitive: [] as number[],
  };

  // Build the average change per characteristic across ALL sectors
  for (const s of withData) {
    const chars = SECTOR_CHARACTERISTICS[s.name] ?? [];
    if (chars.includes("cyclical")) characteristics.cyclical.push(s.changePercent);
    if (chars.includes("defensive")) characteristics.defensive.push(s.changePercent);
    if (chars.includes("growth-sensitive")) characteristics.growthSensitive.push(s.changePercent);
    if (chars.includes("rate-sensitive")) characteristics.rateSensitive.push(s.changePercent);
  }

  // Interpretation
  let interpretation: string | null = null;

  if (withData.length >= 2) {
    const avgCyclical = avg(characteristics.cyclical);
    const avgDefensive = avg(characteristics.defensive);
    const avgGrowth = avg(characteristics.growthSensitive);

    if (avgCyclical !== null && avgDefensive !== null) {
      const diff = avgCyclical - avgDefensive;
      if (diff > 0.5) {
        interpretation = "Cyclical sectors are leading, suggesting an improving economic outlook.";
      } else if (diff < -0.5) {
        interpretation = "Defensive sectors are outperforming, suggesting a cautious market posture.";
      }
    }

    if (interpretation === null && avgGrowth !== null && avgGrowth > 0.5) {
      const nonGrowth = withData
        .filter((s) => {
          const chars = SECTOR_CHARACTERISTICS[s.name] ?? [];
          return !chars.includes("growth-sensitive");
        })
        .reduce((sum, s) => sum + s.changePercent, 0);
      const nonGrowthCount = withData.filter((s) => {
        const chars = SECTOR_CHARACTERISTICS[s.name] ?? [];
        return !chars.includes("growth-sensitive");
      }).length;
      const avgNonGrowth = nonGrowthCount > 0 ? nonGrowth / nonGrowthCount : null;

      if (avgNonGrowth !== null && avgGrowth - avgNonGrowth > 0.5) {
        interpretation = "Growth-sensitive sectors are leading, suggesting a preference for long-duration exposure.";
      }
    }

    if (interpretation === null && leading.length > 0 && lagging.length > 0) {
      const top = leading[0];
      const bottom = lagging[lagging.length - 1];
      const spread = top.changePercent - bottom.changePercent;
      if (spread > 2) {
        interpretation = `Sector leadership is concentrated. ${top.name} leads by ${spread.toFixed(1)} percentage points over ${bottom.name}.`;
      }
    }

    if (interpretation === null) {
      interpretation = "Sector participation is mixed. No clear leadership pattern is evident.";
    }
  } else if (withData.length === 1) {
    const s = withData[0];
    interpretation = `${s.name} is the only sector with available data, up ${s.changePercent.toFixed(1)}% today.`;
  }

  return {
    leading,
    lagging,
    remaining,
    interpretation,
    characteristics: {
      cyclical: characteristics.cyclical,
      defensive: characteristics.defensive,
      growthSensitive: characteristics.growthSensitive,
      rateSensitive: characteristics.rateSensitive,
    },
    missingCount,
  };
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
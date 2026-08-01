"use client";

import { useMemo } from "react";
import { SignalBlock } from "@/components/display/SignalBlock";
import type { PortfolioRiskFlags } from "@/lib/portfolio/types";
import { isFiniteNumber } from "@/lib/display/format";

function weightPct(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${value.toFixed(0)}%`;
}

type CheckItem = {
  id: string;
  eyebrow: string;
  conclusion: string;
  evidence: string;
  badge: { label: string; tone: string };
};

function buildCheckItems(flags: PortfolioRiskFlags): CheckItem[] {
  const items: CheckItem[] = [];

  for (const p of flags.singleConcentration) {
    items.push({
      id: `conc-${p.ticker}`,
      eyebrow: p.ticker,
      conclusion: `${weightPct(p.weight)} of your portfolio`,
      evidence: "Single-name weight is above 20%. A sharp move here would dominate results.",
      badge: { label: "Position", tone: "negative" },
    });
  }

  for (const p of flags.elevatedPositions) {
    items.push({
      id: `elev-${p.ticker}`,
      eyebrow: p.ticker,
      conclusion: `${weightPct(p.weight)} of the portfolio`,
      evidence: "Weight is elevated (12–20%). Worth watching if the position keeps growing.",
      badge: { label: "Note", tone: "amber" },
    });
  }

  for (const s of flags.sectorConcentration) {
    items.push({
      id: `sector-${s.sector}`,
      eyebrow: s.sector,
      conclusion: `${weightPct(s.weight)} of invested assets`,
      evidence: "Sector weight is above 35%. Returns may move together in that group.",
      badge: { label: "Sector", tone: "negative" },
    });
  }

  if (flags.topThreeExceedsSixty) {
    items.push({
      id: "top-three",
      eyebrow: "Top three",
      conclusion: `${weightPct(flags.topThreeCombinedWeight)} of the portfolio`,
      evidence: "Your three largest positions account for more than 60% of the book.",
      badge: { label: "Diversification", tone: "negative" },
    });
  }

  if (flags.missingCostCount > 0) {
    items.push({
      id: "missing-cost",
      eyebrow: "Cost basis",
      conclusion: `Missing for ${flags.missingCostCount} position${flags.missingCostCount > 1 ? "s" : ""}`,
      evidence: "Add average cost so unrealized gain/loss covers the full book.",
      badge: { label: "Data", tone: "quiet" },
    });
  }

  if (flags.missingPriceCount > 0) {
    items.push({
      id: "missing-price",
      eyebrow: "Prices",
      conclusion: `Unavailable for ${flags.missingPriceCount} position${flags.missingPriceCount > 1 ? "s" : ""}`,
      evidence: "Totals and day change reflect only positions with a current price.",
      badge: { label: "Data", tone: "quiet" },
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-clear",
      eyebrow: "Concentration",
      conclusion: "No concentration warnings",
      evidence: "Single-name and sector weights look balanced for this book.",
      badge: { label: "Clear", tone: "positive" },
    });
  }

  return items;
}

/**
 * Portfolio Check in the same carousel / SignalBlock format as What’s changing.
 */
export function PortfolioCheckPanel({ riskFlags }: { riskFlags: PortfolioRiskFlags }) {
  const items = useMemo(() => buildCheckItems(riskFlags), [riskFlags]);

  return (
    <section className="bcn-module" aria-label="Portfolio check">
      <div className="bcn-header">
        <span className="bcn-eyebrow">Check</span>
        <h2 className="bcn-title">Portfolio Check</h2>
        <p className="bcn-lede">
          Concentration and data gaps worth a closer look.
        </p>
      </div>
      <div
        className="bcn-list"
        role="region"
        aria-roledescription="carousel"
        aria-label="Portfolio check cards"
        tabIndex={0}
      >
        {items.map((item) => (
          <div key={item.id} className="bcn-item">
            <SignalBlock
              compact
              eyebrow={item.eyebrow}
              conclusion={item.conclusion}
              evidence={item.evidence}
              badge={item.badge}
            />
          </div>
        ))}
      </div>
      <p className="bcn-footnote">
        Rules-based checks only — not a recommendation to buy or sell.
      </p>
    </section>
  );
}

"use client";

import { useMemo } from "react";
import { SignalBlock } from "@/components/display/SignalBlock";
import type { PortfolioRiskFlags } from "@/lib/portfolio/types";
import { isFiniteNumber } from "@/lib/display/format";

function weightChip(value: number | null): string {
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
      conclusion: "Single-name concentration",
      evidence: "Above 20% of the book — a sharp move here would dominate results.",
      badge: { label: weightChip(p.weight), tone: "negative" },
    });
  }

  for (const p of flags.elevatedPositions) {
    items.push({
      id: `elev-${p.ticker}`,
      eyebrow: p.ticker,
      conclusion: "Elevated weight",
      evidence: "12–20% of the book — watch if the position keeps growing.",
      badge: { label: weightChip(p.weight), tone: "amber" },
    });
  }

  for (const s of flags.sectorConcentration) {
    items.push({
      id: `sector-${s.sector}`,
      eyebrow: s.sector,
      conclusion: "Sector concentration",
      evidence: "Above 35% of invested assets — those names may move together.",
      badge: { label: weightChip(s.weight), tone: "negative" },
    });
  }

  if (flags.topThreeExceedsSixty) {
    items.push({
      id: "top-three",
      eyebrow: "Top three",
      conclusion: "Book is top-heavy",
      evidence: "Largest three positions are more than 60% of the portfolio.",
      badge: { label: weightChip(flags.topThreeCombinedWeight), tone: "negative" },
    });
  }

  if (flags.missingCostCount > 0) {
    items.push({
      id: "missing-cost",
      eyebrow: "Cost basis",
      conclusion: `Missing for ${flags.missingCostCount} position${flags.missingCostCount > 1 ? "s" : ""}`,
      evidence: "Add average cost for full unrealized gain/loss coverage.",
      badge: { label: "Data", tone: "quiet" },
    });
  }

  if (flags.missingPriceCount > 0) {
    items.push({
      id: "missing-price",
      eyebrow: "Prices",
      conclusion: `Unavailable for ${flags.missingPriceCount} position${flags.missingPriceCount > 1 ? "s" : ""}`,
      evidence: "Totals reflect only positions with a current price.",
      badge: { label: "Data", tone: "quiet" },
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-clear",
      eyebrow: "Concentration",
      conclusion: "No concentration warnings",
      evidence: "Single-name and sector weights look balanced.",
      badge: { label: "Clear", tone: "positive" },
    });
  }

  return items;
}

/**
 * Portfolio Check — concentration / data warnings for the book.
 * Use `embedded` when nested under Where your money is.
 */
export function PortfolioCheckPanel({
  riskFlags,
  embedded = false,
}: {
  riskFlags: PortfolioRiskFlags;
  embedded?: boolean;
}) {
  const items = useMemo(() => buildCheckItems(riskFlags), [riskFlags]);

  return (
    <section
      className={`bcn-module${embedded ? " bcn-module-embedded" : " bcn-module-nested"}`}
      aria-label="Portfolio check"
    >
      <div className="bcn-header">
        <h2 className="bcn-title">Portfolio check</h2>
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
              hideMeta
              eyebrow={item.eyebrow}
              conclusion={item.conclusion}
              evidence={item.evidence}
              badge={item.badge}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

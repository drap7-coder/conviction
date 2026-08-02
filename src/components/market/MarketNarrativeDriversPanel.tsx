"use client";

import Link from "next/link";
import { SignalBlock } from "@/components/display/SignalBlock";
import type { MarketNarrativeTheme, NarrativeHeat } from "@/lib/market/market-narratives";
import { isFiniteNumber } from "@/lib/display/format";

function heatLabel(heat: NarrativeHeat): string {
  if (heat === "surging") return "Surging";
  if (heat === "building") return "Building";
  if (heat === "quiet") return "Quiet";
  return "Steady";
}

function heatTone(heat: NarrativeHeat): string {
  if (heat === "surging") return "amber";
  if (heat === "building") return "positive";
  return "quiet";
}

function formatMove(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/**
 * What’s driving the move for a Pulse heatmap group — market narratives
 * as SignalBlock cards (replaces the old bottom narrative card grid).
 */
export function MarketNarrativeDriversPanel({
  themes,
  groupLabel,
}: {
  themes: MarketNarrativeTheme[];
  groupLabel: string;
}) {
  if (themes.length === 0) {
    return (
      <section className="bcn-module bcn-module-nested move-drivers-panel" aria-label="What’s driving the move">
        <div className="bcn-header">
          <h2 className="bcn-title">What’s driving the move</h2>
        </div>
      </section>
    );
  }

  return (
    <section className="bcn-module bcn-module-nested move-drivers-panel" aria-label="What’s driving the move">
      <div className="bcn-header">
        <h2 className="bcn-title">What’s driving the move</h2>
      </div>
      <div
        className="bcn-list"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${groupLabel} drivers`}
        tabIndex={0}
      >
        {themes.map((theme) => {
          const lead = [...theme.assets]
            .filter((asset) => asset.changePercent !== null)
            .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0] ?? null;
          const linked = theme.assets
            .map((asset) => `${asset.ticker} ${formatMove(asset.changePercent)}`)
            .join(" · ");
          // Theme summary leads; one support line only (headline preferred, else linked moves).
          const conclusion = theme.summary;
          const evidence = theme.headline?.title
            ?? (linked || "Linked markets are mixed.");
          const href = theme.headline?.url
            ?? (lead ? `/companies/${encodeURIComponent(lead.ticker)}` : null);

          const card = (
            <SignalBlock
              compact
              hideMeta
              eyebrow={theme.label}
              conclusion={conclusion}
              evidence={evidence}
              badge={{ label: heatLabel(theme.heat), tone: heatTone(theme.heat) }}
            />
          );

          if (theme.headline?.url) {
            return (
              <a
                key={theme.id}
                href={theme.headline.url}
                className="bcn-item"
                target="_blank"
                rel="noopener noreferrer"
              >
                {card}
              </a>
            );
          }

          if (href) {
            return (
              <Link key={theme.id} href={href} className="bcn-item">
                {card}
              </Link>
            );
          }

          return (
            <div key={theme.id} className="bcn-item">
              {card}
            </div>
          );
        })}
      </div>
    </section>
  );
}

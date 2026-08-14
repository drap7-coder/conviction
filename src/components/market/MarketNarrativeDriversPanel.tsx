"use client";

import Link from "next/link";
import { SignalBlock } from "@/components/display/SignalBlock";
import type { MarketNarrativeTheme, NarrativeHeat } from "@/lib/market/market-narratives";
import { companyDetailHref } from "@/lib/market/company-detail-href";
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
 * Narrative insight card for a Pulse asset-class shell
 * (no shared carousel across groups).
 */
export function MarketNarrativeDriversPanel({
  themes,
  groupLabel,
}: {
  themes: MarketNarrativeTheme[];
  groupLabel: string;
}) {
  const theme = themes[0] ?? null;

  if (!theme) return null;

  const lead = [...theme.assets]
    .filter((asset) => asset.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0] ?? null;
  const linked = theme.assets
    .map((asset) => `${asset.ticker} ${formatMove(asset.changePercent)}`)
    .join(" · ");
  const conclusion = theme.summary;
  const evidence = theme.headline?.title
    ?? (linked || "Linked markets are mixed.");
  // External catalyst URL wins; otherwise only link lead assets that have a company page.
  const href = theme.headline?.url
    ?? (lead ? companyDetailHref(lead.ticker) : null);

  // Skip theme.label eyebrow — it usually repeats the headline/summary (e.g. "AI + Compute").
  const card = (
    <SignalBlock
      compact
      hideMeta
      conclusion={conclusion}
      evidence={evidence}
      badge={{ label: heatLabel(theme.heat), tone: heatTone(theme.heat) }}
    />
  );

  return (
    <section className="pulse-why-block" aria-label={`${groupLabel} narrative`}>
      {theme.headline?.url ? (
        <a
          href={theme.headline.url}
          className="pulse-why-card"
          target="_blank"
          rel="noopener noreferrer"
        >
          {card}
        </a>
      ) : href ? (
        <Link href={href} className="pulse-why-card">
          {card}
        </Link>
      ) : (
        <div className="pulse-why-card">{card}</div>
      )}
    </section>
  );
}

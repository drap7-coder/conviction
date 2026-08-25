"use client";

import Link from "next/link";
import type { PulseGlobalMarket } from "@/app/api/market/pulse/route";
import { MarketScoreboard } from "@/components/market/IndexScoreboard";
import { fmtDollarPrice, isFiniteNumber } from "@/lib/display/format";
import { heatChipColors } from "@/lib/display/heat-color";
import { companyDetailHref } from "@/lib/market/company-detail-href";

function fmtPct(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) < 0.05) return "0.0%";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/**
 * Horizontal related-names strip under the Crypto index board
 * (exchange / miner / treasury equities that move with the tape).
 */
function CryptoRelatedStrip({ markets }: { markets: PulseGlobalMarket[] }) {
  if (markets.length === 0) return null;

  return (
    <section className="pulse-crypto-related" aria-label="Crypto-related equities">
      <p className="pulse-crypto-related-label">Related</p>
      <ul className="pulse-crypto-related-list">
        {markets.map((market) => {
          const chip = heatChipColors(market.changePercent);
          const href = companyDetailHref(market.ticker);
          const label = `${market.name}, ${fmtDollarPrice(market.price)}, ${fmtPct(market.changePercent)}`;
          const body = (
            <>
              <strong>{market.ticker}</strong>
              <span className="tnum">{fmtDollarPrice(market.price)}</span>
              <em
                className="tnum"
                style={{ background: chip.background, color: chip.color }}
              >
                {fmtPct(market.changePercent)}
              </em>
            </>
          );
          return (
            <li key={market.ticker}>
              {href ? (
                <Link href={href} className="pulse-crypto-related-chip" aria-label={label}>
                  {body}
                </Link>
              ) : (
                <div className="pulse-crypto-related-chip" aria-label={label}>
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Crypto as an index-style board, plus related equity chips. */
export function CryptoBoard({
  markets,
  related = [],
}: {
  markets: PulseGlobalMarket[];
  related?: PulseGlobalMarket[];
}) {
  if (markets.length === 0 && related.length === 0) return null;

  return (
    <div className="pulse-crypto-board">
      {markets.length > 0 ? (
        <MarketScoreboard title="Crypto" rows={markets} />
      ) : null}
      <CryptoRelatedStrip markets={related} />
    </div>
  );
}

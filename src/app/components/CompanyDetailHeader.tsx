"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import { getConvictionBadge } from "@/lib/conviction/canonical-types";
import { buildConvictionSnapshot } from "@/lib/conviction/canonical";
import type { StockQuote } from "@/lib/market/quotes";

interface CompanyDetailHeaderProps {
  ticker: string;
  companyName: string;
  sectorName: string | null;
  sectorColors: { c1: string; c2: string } | undefined;
  logoUrl: string | null;
}

function formatPrice(value: number | null): string {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: value >= 100 ? 2 : 3,
    minimumFractionDigits: value >= 1 ? 2 : 3,
  });
}

function formatChange(value: number | null, percent: number | null) {
  if (value === null || percent === null) return null;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return {
    dollars: `${sign}$${Math.abs(value).toFixed(2)}`,
    percent: `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`,
  };
}

export function CompanyDetailHeader({
  ticker,
  companyName,
  sectorName,
  sectorColors,
  logoUrl,
}: CompanyDetailHeaderProps) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { quotes?: StockQuote[] };
        if (!cancelled) {
          setQuote((data.quotes ?? [])[0] ?? null);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [ticker]);

  const live = useMemo(() => quote ? getLivePrice(quote) : null, [quote]);

  const isExtendedSession = live?.session === "pre_market" || live?.session === "after_hours";

  let changeText: ReturnType<typeof formatChange> = null;
  let arrow: string | null = null;
  if (live) {
    changeText = (live.change !== null && live.changePercent !== null)
      ? formatChange(live.change, live.changePercent)
      : null;
    arrow = live.change !== null
      ? (live.change > 0 ? "▲" : live.change < 0 ? "▼" : null)
      : null;
  }

  // Regular-session change for "At Close" line
  let regularChangeText: ReturnType<typeof formatChange> = null;
  if (quote) {
    regularChangeText = (quote.change !== null && quote.changePercent !== null)
      ? formatChange(quote.change, quote.changePercent)
      : null;
  }

  // ── Build a conviction snapshot for the badge ──
  const badge = useMemo(() => {
    // We don't have evidence data here, so build a minimal snapshot
    if (!quote) return null;
    const snapshot = buildConvictionSnapshot({
      ticker,
      institutional: null,
      insider: null,
      earnings: null,
      political: null,
      historyPoints: [],
      quote,
      week52High: null,
      week52Low: null,
    });
    return getConvictionBadge(snapshot);
  }, [ticker, quote]);

  return (
    <div className="detail-header">
      <div className="detail-nav">
        <Link href="/" className="detail-back">
          ← Watchlist
        </Link>
        <span className="demo-badge">Live data</span>
      </div>

      <div className="cdh-body">
        {/* ── Left: identity ── */}
        <div className="cdh-identity">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="cdh-logo" />
          ) : (
            <div className="logo-badge logo-badge-detail">{ticker.charAt(0)}</div>
          )}
          <div>
            <div className="cdh-title-row">
              <h1 className="cdh-ticker">{ticker}</h1>
              {sectorName ? (
                <span
                  className="company-sector-tag"
                  style={sectorColors ? {
                    background: `linear-gradient(135deg, ${sectorColors.c1}, ${sectorColors.c2})`,
                  } : undefined}
                >
                  {sectorName}
                </span>
              ) : null}
              {badge && badge.verdict !== "Insufficient" ? (
                <span className={`cdh-badge cdh-badge-${badge.tone}`}>
                  {badge.verdict}
                </span>
              ) : null}
            </div>
            <p className="cdh-name">{companyName}</p>
          </div>
        </div>

        {/* ── Right: price ── */}
        <div className="cdh-prices">
          {/* Live price — always the biggest number */}
          <div className="cdh-live-price">
            {loading ? (
              <span className="cdh-price-loading">—</span>
            ) : live?.price != null ? (
              <>
                <span className={`cdh-arrow ${live.change !== null && live.change > 0 ? "up" : live.change !== null && live.change < 0 ? "down" : ""}`}>
                  {arrow}
                </span>
                <span className="cdh-price-big">
                  ${formatPrice(live.price)}
                </span>
                {changeText && (
                  <span className={`cdh-change ${live.change !== null && live.change > 0 ? "up" : live.change !== null && live.change < 0 ? "down" : ""}`}>
                    {changeText.dollars} ({changeText.percent})
                  </span>
                )}
              </>
            ) : (
              <span className="cdh-price-na">Price unavailable</span>
            )}
          </div>

          {/* Session label + reference price */}
          {isExtendedSession && quote ? (
            <div className="cdh-session-row">
              <span className="cdh-session-label">
                {live?.session === "after_hours" ? "After Hours" : "Pre-Market"}
              </span>
              <span className="cdh-session-ref">
                <span className="cdh-ref-label">At Close · Today</span>
                <span className="cdh-ref-price">
                  ${formatPrice(quote.price)}
                </span>
                {regularChangeText && (
                  <span className={`cdh-ref-change ${quote.change !== null && quote.change > 0 ? "up" : quote.change !== null && quote.change < 0 ? "down" : ""}`}>
                    {regularChangeText.percent}
                  </span>
                )}
              </span>
            </div>
          ) : !loading && quote ? (
            <div className="cdh-session-row">
              <span className="cdh-session-label">At Close · Today</span>
              <span className={`cdh-ref-change ${quote.change !== null && quote.change > 0 ? "up" : quote.change !== null && quote.change < 0 ? "down" : ""}`}>
                {regularChangeText ? `${regularChangeText.dollars} (${regularChangeText.percent})` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

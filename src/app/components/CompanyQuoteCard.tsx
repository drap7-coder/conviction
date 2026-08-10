"use client";

import { useEffect, useMemo, useState } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { buildMoveDriverView } from "@/lib/evidence/move-driver-brief";
import { inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";
import { PriceTrendCard } from "@/app/components/PriceTrendCard";

interface CompanyQuoteCardProps {
  ticker: string;
  companyName: string;
  sectorName: string | null;
  logoUrl: string | null;
}

interface NewsEvidenceResponse {
  events?: EvidenceEvent[];
  driver?: NewsDriver | null;
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

/**
 * One card for who it is, what it costs, and how it moves.
 * Identity + quote above a pencil rule; chart below.
 */
export function CompanyQuoteCard({
  ticker,
  companyName,
  sectorName,
  logoUrl,
}: CompanyQuoteCardProps) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [catalystBadge, setCatalystBadge] = useState<{ label: string; tone: string } | null>(null);

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
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Catalyst kind pill lives on the quote card so the news headline can stay full-width.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadCatalyst() {
      try {
        const res = await fetch(`/api/evidence/news?ticker=${encodeURIComponent(ticker)}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = (await res.json()) as NewsEvidenceResponse;
        if (cancelled) return;

        const headlines = (data.events ?? []).slice(0, 6).map((event) => ({
          headline: event.title,
          url: event.sourceUrl ?? null,
          date: event.date,
        }));
        const view = buildMoveDriverView({
          ticker,
          companyName,
          driver: data.driver ?? null,
          headlines,
          showBadge: true,
        });
        setCatalystBadge(view.mode === "catalyst" ? view.badge : null);
      } catch {
        if (!cancelled) setCatalystBadge(null);
      }
    }

    void loadCatalyst();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, companyName]);

  const live = useMemo(() => (quote ? getLivePrice(quote) : null), [quote]);
  const isExtendedSession = live?.session === "pre_market" || live?.session === "after_hours";

  let changeText: ReturnType<typeof formatChange> = null;
  let arrow: string | null = null;
  if (live) {
    changeText = live.change !== null && live.changePercent !== null
      ? formatChange(live.change, live.changePercent)
      : null;
    arrow = live.change !== null
      ? (live.change > 0 ? "▲" : live.change < 0 ? "▼" : null)
      : null;
  }

  let regularChangeText: ReturnType<typeof formatChange> = null;
  if (quote) {
    regularChangeText = quote.change !== null && quote.changePercent !== null
      ? formatChange(quote.change, quote.changePercent)
      : null;
  }

  const direction = live?.change != null
    ? live.change > 0 ? "up" : live.change < 0 ? "down" : ""
    : "";

  return (
    <section className="company-quote-card ink-panel" aria-label={`${ticker} quote and chart`}>
      <header className="company-quote-top">
        <div className="company-quote-identity">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="company-quote-logo" />
          ) : (
            <div className="logo-badge logo-badge-detail" aria-hidden="true">
              {ticker.charAt(0)}
            </div>
          )}
          <div className="company-quote-copy">
            <h1 className="company-quote-ticker">{ticker}</h1>
            <p className="company-quote-name">
              {companyName}
              {sectorName ? (
                <>
                  <span className="company-quote-sep" aria-hidden="true">·</span>
                  <span className="company-quote-sector">{sectorName}</span>
                </>
              ) : null}
            </p>
            {catalystBadge ? (
              <span
                className={`${inkChipClass(inkToneFromSemantic(catalystBadge.tone))} company-quote-catalyst`}
              >
                {catalystBadge.label}
              </span>
            ) : null}
          </div>
        </div>

        <div className="company-quote-price" aria-label={`${ticker} price`}>
          <span className={`evidence-live-pill company-live-pill${loading ? " is-updating" : ""}`}>
            <span className="company-live-dot" aria-hidden="true">
              <i className="company-live-ping" />
              <i className="company-live-core" />
            </span>
            {loading ? "Updating" : "Live"}
          </span>
          {loading ? (
            <span className="company-quote-price-loading">—</span>
          ) : live?.price != null ? (
            <>
              <div className="company-quote-price-row">
                <span className={`company-quote-arrow ${direction}`}>{arrow}</span>
                <span className="company-quote-price-big">${formatPrice(live.price)}</span>
              </div>
              {changeText ? (
                <span className={`company-quote-change ${direction}`}>
                  {changeText.dollars}
                  <span aria-hidden="true"> · </span>
                  {changeText.percent}
                  {live.label ? (
                    <span className="company-quote-session"> {live.label}</span>
                  ) : null}
                </span>
              ) : live.label ? (
                <span className="company-quote-session">{live.label}</span>
              ) : null}
              {isExtendedSession && quote ? (
                <span className="company-quote-close">
                  Close ${formatPrice(quote.price)}
                  {regularChangeText ? ` · ${regularChangeText.percent}` : ""}
                </span>
              ) : null}
            </>
          ) : (
            <span className="company-quote-price-na">Price unavailable</span>
          )}
        </div>
      </header>

      <div className="company-quote-rule" aria-hidden="true" />

      <PriceTrendCard ticker={ticker} showQuote={false} embedded />
    </section>
  );
}

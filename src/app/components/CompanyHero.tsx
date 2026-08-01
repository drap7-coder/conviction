"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { GaugeRing, type GaugeTone } from "@/components/GaugeRing";
import { MaterialNewsCard } from "@/app/components/MaterialNewsCard";
import { TrackCompanyButton } from "@/app/components/TrackCompanyButton";
import { fetchConvictionScore } from "@/app/components/fetch-conviction-score";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";

interface CompanyHeroProps {
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

export function CompanyHero({
  ticker,
  companyName,
  sectorName,
  sectorColors,
  logoUrl,
}: CompanyHeroProps) {
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(true);
  const [score, setScore] = useState<ConvictionScoreView | null>(null);
  const [scoreLoading, setScoreLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadQuote() {
      try {
        const res = await fetch(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`);
        if (!res.ok) return;
        const data = (await res.json()) as { quotes?: StockQuote[] };
        if (!cancelled) setQuote((data.quotes ?? [])[0] ?? null);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    }
    void loadQuote();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadScore() {
      setScoreLoading(true);
      const next = await fetchConvictionScore(ticker, controller.signal);
      if (!cancelled) {
        setScore(next);
        setScoreLoading(false);
      }
    }
    void loadScore();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const live = useMemo(() => (quote ? getLivePrice(quote) : null), [quote]);
  const isExtendedSession = live?.session === "pre_market" || live?.session === "after_hours";
  const changeText = live && live.change !== null && live.changePercent !== null
    ? formatChange(live.change, live.changePercent)
    : null;
  const arrow = live?.change != null
    ? (live.change > 0 ? "▲" : live.change < 0 ? "▼" : null)
    : null;
  const regularChangeText = quote && quote.change !== null && quote.changePercent !== null
    ? formatChange(quote.change, quote.changePercent)
    : null;

  const tone = (score?.tone ?? "neutral") as GaugeTone;
  const ringLabel = score?.ringLabel ?? "Awaiting";
  const detail = score?.detail
    ?? (scoreLoading
      ? "Loading quality and evidence…"
      : "Conviction score could not be loaded.");

  return (
    <section className="company-hero ink-panel" aria-label={`${ticker} overview`}>
      <div className="company-hero-nav">
        <Link href="/" className="company-hero-back">
          ← Watchlist
        </Link>
        <TrackCompanyButton ticker={ticker} companyName={companyName} />
      </div>

      <div className="company-hero-masthead">
        <div className="company-hero-identity">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="company-hero-logo" />
          ) : (
            <div className="company-hero-mark" aria-hidden="true">{ticker.charAt(0)}</div>
          )}
          <div className="company-hero-titles">
            <div className="company-hero-title-row">
              <h1 className="company-hero-ticker">{ticker}</h1>
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
            </div>
            <p className="company-hero-name">{companyName}</p>
          </div>
        </div>

        <div className="company-hero-price" aria-label="Live price">
          {quoteLoading ? (
            <span className="company-hero-price-loading">—</span>
          ) : live?.price != null ? (
            <>
              <span className="company-hero-price-primary">
                <span className={`company-hero-arrow ${live.change != null && live.change > 0 ? "up" : live.change != null && live.change < 0 ? "down" : ""}`}>
                  {arrow}
                </span>
                <strong className="company-hero-price-value">${formatPrice(live.price)}</strong>
                {live.label ? <span className="company-hero-session">{live.label}</span> : null}
              </span>
              {changeText ? (
                <span className={`company-hero-change ${live.change != null && live.change > 0 ? "up" : live.change != null && live.change < 0 ? "down" : ""}`}>
                  {changeText.dollars} ({changeText.percent})
                </span>
              ) : null}
            </>
          ) : (
            <span className="company-hero-price-na">Price unavailable</span>
          )}
          {isExtendedSession && quote ? (
            <span className="company-hero-close-ref">
              At close ${formatPrice(quote.price)}
              {regularChangeText ? ` · ${regularChangeText.percent}` : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="company-hero-core">
        <div className="company-hero-score">
          <GaugeRing
            size="lg"
            value={scoreLoading ? null : score?.displayScore ?? null}
            label={scoreLoading ? "…" : score?.displayScore != null ? String(score.displayScore) : "—"}
            sublabel={scoreLoading ? "SCORING" : ringLabel.toUpperCase()}
            caption=""
            tone={tone}
            loading={scoreLoading}
            ariaLabel={
              scoreLoading
                ? "Conviction score computing"
                : `Conviction score ${score?.displayScore ?? "unavailable"} of 100: ${ringLabel}`
            }
          />
          <p className="company-hero-score-detail">{detail}</p>
        </div>

        <div className="company-hero-driver">
          <MaterialNewsCard ticker={ticker} companyName={companyName} compact />
        </div>
      </div>

      <div className="company-hero-actions">
        <a href="#company-evidence" className="company-hero-evidence-cta">
          See evidence
          <span aria-hidden="true"> →</span>
        </a>
      </div>
    </section>
  );
}

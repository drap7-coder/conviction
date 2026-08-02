"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getLivePrice } from "@/lib/market/live-quote";
import { fetchConvictionScore } from "@/app/components/fetch-conviction-score";
import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import {
  catalystFromGradeActions,
  deriveTodayCatalyst,
  type TodayCatalyst,
} from "@/lib/evidence/today-catalyst";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import type { EarningsEvidence } from "@/lib/earnings/types";
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
  const [newsCatalyst, setNewsCatalyst] = useState<TodayCatalyst | null>(null);
  const [convictionScore, setConvictionScore] = useState<ConvictionScoreView | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadCatalyst() {
      try {
        const [newsRes, earningsRes] = await Promise.all([
          fetch(`/api/evidence/news?ticker=${encodeURIComponent(ticker)}`, {
            signal: controller.signal,
          }),
          fetch(`/api/evidence/earnings?ticker=${encodeURIComponent(ticker)}`, {
            signal: controller.signal,
          }),
        ]);

        const newsData = newsRes.ok
          ? ((await newsRes.json()) as {
              events?: EvidenceEvent[];
              driver?: NewsDriver | null;
            })
          : null;
        const earningsData = earningsRes.ok
          ? ((await earningsRes.json()) as EarningsEvidence)
          : null;
        if (cancelled) return;

        const events = newsData?.events ?? [];
        const fromNews = deriveTodayCatalyst(
          events.slice(0, 8).map((event) => ({
            headline: event.title,
            date: event.date,
            summary: event.summary,
          })),
          newsData?.driver?.label,
          { ticker, companyName },
        );
        const fromGrades = catalystFromGradeActions(earningsData?.gradeActions ?? []);

        // Prefer headline catalysts; fall back to structured Street grades.
        setNewsCatalyst(fromNews ?? fromGrades);
      } catch {
        // ignore
      }
    }

    void loadCatalyst();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, companyName]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    async function loadScore() {
      const next = await fetchConvictionScore(ticker, controller.signal);
      if (!cancelled) setConvictionScore(next);
    }
    void loadScore();
    return () => {
      cancelled = true;
      controller.abort();
    };
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

  // Same shared score as the dashboard ring — only when news has no clear catalyst.
  const convictionBadge = useMemo(() => {
    if (newsCatalyst || !convictionScore || convictionScore.displayScore === null) return null;
    return {
      verdict: convictionScore.ringLabel,
      tone: convictionScore.tone === "green"
        ? "positive"
        : convictionScore.tone === "red"
          ? "negative"
          : convictionScore.tone === "amber"
            ? "contested"
            : "quiet",
    };
  }, [newsCatalyst, convictionScore]);

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
              {newsCatalyst ? (
                <span className={`cdh-badge cdh-badge-${newsCatalyst.tone}`}>
                  {newsCatalyst.label}
                </span>
              ) : convictionBadge && convictionBadge.verdict !== "Awaiting" ? (
                <span className={`cdh-badge cdh-badge-${convictionBadge.tone}`}>
                  {convictionBadge.verdict}
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
                {live.label ? (
                  <span className="cdh-price-session">{live.label}</span>
                ) : null}
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

          {/* At-close reference — only during extended hours */}
          {isExtendedSession && quote ? (
            <div className="cdh-session-row">
              <span className="cdh-session-ref">
                <span className="cdh-ref-label">At close</span>
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
          ) : null}
        </div>
      </div>
    </div>
  );
}

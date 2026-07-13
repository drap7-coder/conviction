"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FIXTURE_COMPANIES, FIXTURE_TICKERS, DEMO_LABEL } from "@/lib/evidence/fixtures";

interface InsiderSummary {
  ticker: string;
  bullish: boolean;
  bearish: boolean;
  purchases: number;
  sales: number;
  netShares: number;
  convictionScore: number;
  breakdown: string;
}

export default function WatchlistPage() {
  const companies = FIXTURE_TICKERS.map((t) => FIXTURE_COMPANIES[t]);
  const [insiderSummaries, setInsiderSummaries] = useState<Record<string, InsiderSummary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadInsiderData() {
      const results: Record<string, InsiderSummary> = {};
      await Promise.all(
        FIXTURE_TICKERS.map(async (ticker) => {
          try {
            const res = await fetch(`/api/evidence/insider?ticker=${ticker}`);
            if (!res.ok) return;
            const data = await res.json();
            const events = data.events ?? [];
            if (!events.length) return;

            const byType = new Map<string, { count: number; shares: number; value: number }>();
            for (const e of events) {
              const t = e.metadata?.transactionType || "other";
              const row = byType.get(t) || { count: 0, shares: 0, value: 0 };
              row.count++;
              row.shares += e.metadata?.shares || 0;
              row.value += e.metadata?.totalValue || 0;
              byType.set(t, row);
            }

            const purchases = byType.get("purchase");
            const sales = byType.get("sale");
            const netShares = (purchases?.shares || 0) - (sales?.shares || 0);
            const purchaseValue = purchases?.value || 0;
            const saleValue = (sales?.value || 0) * 0.4;
            const convictionScore = Math.round((purchaseValue - saleValue) / 1000);

            const parts: string[] = [];
            const order = ["purchase", "sale", "grant", "option_exercise", "gift", "tax_withholding", "other"];
            for (const t of order) {
              const row = byType.get(t);
              if (row) parts.push(`${row.count} ${t.replace(/_/g, " ")}`);
            }

            results[ticker] = {
              ticker,
              bullish: netShares > 0 && convictionScore > 0,
              bearish: netShares < 0 || convictionScore < -50,
              purchases: purchases?.count || 0,
              sales: sales?.count || 0,
              netShares,
              convictionScore,
              breakdown: parts.join(", "),
            };
          } catch {
            // ignore fetch errors
          }
        }),
      );
      setInsiderSummaries(results);
      setLoading(false);
    }
    loadInsiderData();
  }, []);

  const strengthLabel = (s: number) => {
    if (s >= 0.7) return "strong";
    if (s >= 0.5) return "moderate";
    return "weak";
  };

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Watchlist</h2>
        <span className="section-count">{companies.length} companies</span>
      </div>

      <div className="company-grid">
        {companies.map((c) => {
          const insider = insiderSummaries[c.ticker];
          return (
            <Link key={c.ticker} href={`/companies/${c.ticker}`} className="company-card">
              <div className="card-header">
                <span className="card-ticker">{c.ticker}</span>
                <span className="card-name">{c.name}</span>
              </div>

              {/* Insider conviction signal — overrides fixture data when real */}
              {insider ? (
                <div className="card-change" style={{
                  color: insider.bullish ? "var(--green)" : insider.bearish ? "var(--red)" : "var(--muted)",
                }}>
                  {insider.bullish ? "▲" : insider.bearish ? "▼" : "◆"} Insider{" "}
                  {insider.bullish ? "Bullish" : insider.bearish ? "Bearish" : "Neutral"}
                  {insider.netShares !== 0 && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", marginLeft: 4 }}>
                      ({insider.netShares > 0 ? "+" : ""}{insider.netShares.toLocaleString()} net shares)
                    </span>
                  )}
                </div>
              ) : (
                <div className="card-change">{c.latestChange}</div>
              )}

              <div className="card-implication">
                {insider ? `Conviction score: ${insider.convictionScore > 0 ? "+" : ""}${insider.convictionScore}` : (loading ? "Loading insider data..." : c.implication)}
              </div>

              {/* Breakdown chip */}
              {!loading && insider && (
                <div className="card-metrics mt-8" style={{ flexWrap: "wrap", gap: 4 }}>
                  <span className="metric-label" style={{ fontSize: "0.5rem" }}>
                    {insider.breakdown}
                  </span>
                </div>
              )}

              <div className="card-metrics">
                <span className="metric">
                  <span className="metric-label">strength</span>
                  <span className={`metric-value ${strengthLabel(c.evidenceStrength)}`}>
                    {(c.evidenceStrength * 100).toFixed(0)}%
                  </span>
                </span>
                <span className="metric">
                  <span className="strength-bar">
                    <div
                      className={`strength-bar-fill ${insider?.bullish ? "positive" : insider?.bearish ? "negative" : "neutral"}`}
                      style={{ width: `${c.evidenceStrength * 100}%` }}
                    />
                  </span>
                </span>
                <span className="event-count">{c.newEventCount} events</span>
              </div>

              {c.contradiction ? (
                <div className="card-metrics mt-8">
                  <span className="metric">
                    <span className="metric-label warning">contradiction</span>
                    <span className="metric-value warning">{c.contradiction}</span>
                  </span>
                </div>
              ) : null}

              <div className="card-metrics mt-8">
                <span className="metric">
                  <span className="metric-label">next</span>
                  <span className="metric-value">{c.nextCatalyst}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "var(--quiet)", textAlign: "center", marginTop: 16 }}>
        {!loading ? "Watchlist powered by SEC EDGAR Form 4 insider data" : DEMO_LABEL}
      </p>
    </div>
  );
}
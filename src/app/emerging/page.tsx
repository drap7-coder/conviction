"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FIXTURE_EMERGING, FIXTURE_TICKERS, FIXTURE_COMPANIES, DEMO_LABEL } from "@/lib/evidence/fixtures";
import type { EvidenceEvent, ReasonCode, EmergingIdea } from "@/lib/evidence/types";

const SECTOR_LOOKUP: Record<string, string> = {
  OXY: "Oil & Gas",
  INTC: "Semiconductors",
  GOOG: "Technology",
  NVO: "Pharmaceuticals",
  PFE: "Pharmaceuticals",
  NBIS: "Technology",
  CRWD: "Cybersecurity",
  ONON: "Consumer",
  PLTR: "Technology",
  RXRX: "Biotechnology",
  AVAV: "Defense",
};

export default function EmergingPage() {
  const [realEmerging, setRealEmerging] = useState<EmergingIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRealData() {
      try {
        const results = await Promise.all(
          FIXTURE_TICKERS.map(async (ticker) => {
            const res = await fetch(`/api/evidence/insider?ticker=${ticker}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (!data.events?.length) return null;

            const company = FIXTURE_COMPANIES[ticker];
            if (!company) return null;

            const events = data.events as EvidenceEvent[];

            // Use conviction-aware evaluation with new type system
            const directional = events.filter(
              (e) => e.metadata?.transactionType === "purchase" ||
                     e.metadata?.transactionType === "sale",
            );
            if (directional.length === 0) return null;

            const reasonCodes: ReasonCode[] = [];

            // Net conviction
            let netScore = 0;
            let netShares = 0;
            for (const e of directional) {
              const v = e.metadata?.totalValue || 0;
              const s = e.metadata?.shares || 0;
              if (e.metadata?.transactionType === "purchase") {
                netScore += Math.round(v / 1000);
                netShares += s;
              } else {
                netScore -= Math.round(v / 1000 * 0.4);
                netShares -= s;
              }
            }

            if (netScore >= 200) {
              reasonCodes.push({
                code: "insider-conviction",
                label: `Strong insider conviction (${netScore > 0 ? "+" : ""}${netScore})`,
                positive: true,
                strength: Math.min(1, netScore / 500),
              });
            }

            // Clustered buying
            const buyers = new Set(
              events
                .filter((e) => e.metadata?.transactionType === "purchase")
                .map((e) => e.metadata?.insiderName),
            );
            const purchases = events.filter(
              (e) => e.metadata?.transactionType === "purchase",
            );

            if (buyers.size >= 2 && purchases.length >= 2) {
              reasonCodes.push({
                code: "clustered-insider",
                label: "Clustered insider buying from SEC Form 4",
                positive: true,
                strength: Math.min(1, netScore / 300 + 0.2),
              });
            }

            // Large individual purchase
            for (const purchase of purchases) {
              if (purchase.strength >= 0.7) {
                reasonCodes.push({
                  code: "large-insider-purchase",
                  label: `Large purchase by ${purchase.metadata?.insiderName}`,
                  positive: true,
                  strength: purchase.strength,
                });
                break;
              }
            }

            if (reasonCodes.length === 0) return null;

            const topEvent = [...events].sort((a, b) => b.strength - a.strength)[0];

            return {
              ticker,
              name: company.name,
              sector: SECTOR_LOOKUP[ticker] ?? "Unknown",
              reasonCodes,
              topEvent,
            } as EmergingIdea;
          }),
        );

        const valid = results.filter((r): r is EmergingIdea => r !== null);
        setRealEmerging(valid);
      } catch (err) {
        console.warn("[emerging] Failed to load real data:", err);
        setFetchError("Failed to load real insider data");
      } finally {
        setLoading(false);
      }
    }

    loadRealData();
  }, []);

  const displayEmerging = loading
    ? FIXTURE_EMERGING
    : realEmerging.length > 0
      ? realEmerging
      : FIXTURE_EMERGING;

  const hasRealData = !loading && realEmerging.length > 0;

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Emerging evidence</h2>
        <div className="flex items-center gap-8">
          <span className="section-count">
            {displayEmerging.length} companies
          </span>
          {hasRealData ? (
            <span className="demo-badge" style={{ background: "var(--green-dim)", color: "var(--green)" }}>
              REAL DATA
            </span>
          ) : (
            <span className="demo-badge">DEMO DATA</span>
          )}
        </div>
      </div>

      {!loading && fetchError ? (
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.55rem", color: "var(--muted)", marginBottom: 8 }}>
          {fetchError}. Showing demo data.
        </p>
      ) : null}

      {loading ? (
        <div className="empty-state">
          <p>Loading evidence data...</p>
        </div>
      ) : displayEmerging.length === 0 ? (
        <div className="empty-state">
          <p>No emerging ideas right now.</p>
          <small>New evidence is evaluated daily.</small>
        </div>
      ) : (
        <div className="emerging-list">
          {displayEmerging.map((idea) => (
            <div key={idea.ticker} className="emerging-card">
              <div className="emerging-header">
                <span className="card-ticker">{idea.ticker}</span>
                <span className="card-name">{idea.name} · {idea.sector}</span>
              </div>

              <div className="reason-codes">
                {idea.reasonCodes.map((rc) => (
                  <span
                    key={rc.code}
                    className={`reason-code ${rc.positive ? "positive" : "negative"}`}
                  >
                    {rc.positive ? "+" : "−"} {rc.label}
                  </span>
                ))}
              </div>

              <div className="emerging-event">
                <strong>Top signal:</strong> {idea.topEvent.title}
              </div>
              {idea.topEvent.aiExplanation ? (
                <div className="emerging-event mt-8">
                  {idea.topEvent.aiExplanation}
                </div>
              ) : null}

              <div className="flex items-center gap-8 mt-8">
                <span className="metric">
                  <span className="metric-label">strength</span>
                  <span className="metric-value strong">
                    {(
                      idea.reasonCodes
                        .filter((r) => r.positive)
                        .reduce((s, r) => s + r.strength, 0) /
                      Math.max(idea.reasonCodes.filter((r) => r.positive).length, 1) *
                      100
                    ).toFixed(0)}
                    %
                  </span>
                </span>
                <Link
                  href={`/companies/${idea.ticker}`}
                  className="detail-back"
                >
                  View company →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "var(--quiet)",
          textAlign: "center",
          marginTop: 16,
        }}
      >
        {hasRealData ? "Powered by SEC EDGAR Form 4 data" : DEMO_LABEL}
      </p>
    </div>
  );
}
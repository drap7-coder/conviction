"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EvidenceEvent, ReasonCode } from "@/lib/evidence/types";
import type { EmergingIdea } from "@/lib/evidence/types";

interface WatchlistEntry {
  ticker: string;
  companyName: string;
  status: string;
  lastSyncedAt?: string;
}

export default function RisingConvictionPage() {
  const [ideas, setIdeas] = useState<EmergingIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRisingConviction() {
      try {
        // Load watchlist first
        const wlRes = await fetch("/api/watchlist");
        if (!wlRes.ok) {
          setError("Failed to load watchlist");
          setLoading(false);
          return;
        }
        const wlData = await wlRes.json();
        const activeEntries: WatchlistEntry[] = (wlData.entries ?? []).filter(
          (e: WatchlistEntry) => e.status === "active",
        );

        if (activeEntries.length === 0) {
          setError("No active companies in watchlist to evaluate");
          setLoading(false);
          return;
        }

        // Fetch insider data for each active watchlist company
        const results = await Promise.all(
          activeEntries.map(async (entry) => {
            const res = await fetch(`/api/evidence/insider?ticker=${entry.ticker}`);
            if (!res.ok) return null;
            const data = await res.json();
            if (!data.events?.length) return null;

            const events = data.events as EvidenceEvent[];

            // Evaluate conviction: only directional transactions matter
            const directional = events.filter(
              (e) => e.metadata?.transactionType === "purchase" ||
                     e.metadata?.transactionType === "sale",
            );
            if (directional.length === 0) return null;

            // Calculate net conviction score
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

            const reasonCodes: ReasonCode[] = [];

            // Strong conviction signal
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
                label: "Clustered insider buying",
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

            // Bearish signal (contradiction)
            if (netScore <= -100) {
              reasonCodes.push({
                code: "insider-selling",
                label: `Notable insider selling (${netScore})`,
                positive: false,
                strength: Math.min(1, Math.abs(netScore) / 400),
              });
            }

            if (reasonCodes.length === 0) return null;

            const topEvent = [...events].sort((a, b) => b.strength - a.strength)[0];

            return {
              ticker: entry.ticker,
              name: entry.companyName,
              sector: "Watchlist",
              reasonCodes,
              topEvent,
            } as EmergingIdea;
          }),
        );

        const valid = results.filter((r): r is EmergingIdea => r !== null);
        setIdeas(valid);
      } catch (err) {
        console.warn("[rising] Failed to load data:", err);
        setError("Failed to load insider data");
      } finally {
        setLoading(false);
      }
    }

    loadRisingConviction();
  }, []);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Rising conviction</h2>
        <span className="section-count">
          {loading ? "..." : `${ideas.length} companies`}
        </span>
      </div>

      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.55rem",
        color: "var(--quiet)",
        marginBottom: 16,
        maxWidth: 500,
      }}>
        Watchlist companies showing stronger or newer insider-buying signals.
        The name <em>Emerging</em> is reserved for a future feature that scans
        companies outside your watchlist.
      </p>

      {loading ? (
        <div className="empty-state">
          <p>Evaluating insider signals...</p>
        </div>
      ) : error && ideas.length === 0 ? (
        <div className="empty-state">
          <p>{error}</p>
          <small>Add companies to your watchlist and sync their SEC data first.</small>
        </div>
      ) : ideas.length === 0 ? (
        <div className="empty-state">
          <p>No rising conviction signals right now.</p>
          <small>This section highlights watchlist companies with notable insider buying activity.</small>
        </div>
      ) : (
        <div className="emerging-list">
          {ideas.map((idea) => (
            <div key={idea.ticker} className="emerging-card">
              <div className="emerging-header">
                <span className="card-ticker">{idea.ticker}</span>
                <span className="card-name">{idea.name}</span>
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

      <p style={{
        fontFamily: "var(--font-mono)",
        fontSize: "0.55rem",
        color: "var(--quiet)",
        textAlign: "center",
        marginTop: 16,
      }}>
        Powered by SEC EDGAR Form 4 insider data
      </p>
    </div>
  );
}
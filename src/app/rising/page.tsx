"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";

interface InstitutionalEmergingIdea {
  ticker: string;
  name: string;
  score: number;
  aggregateShareChange: number;
  newPositions: number;
  increased: number;
  reduced: number;
  exited: number;
  latestFilingDate: string;
  topSignals: InstitutionalAccumulation[];
}

interface InstitutionalEmergingResponse {
  ideas: InstitutionalEmergingIdea[];
  total: number;
  source: "sec-13f";
  fetchedAt: string;
}

function formatShares(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function signalLabel(signal: InstitutionalAccumulation) {
  if (signal.status === "New") return `${signal.displayName} opened a position`;
  if (signal.status === "Increased") {
    return `${signal.displayName} added ${formatShares(signal.shareChange)} shares`;
  }
  return `${signal.displayName}: ${signal.status}`;
}

export default function RisingConvictionPage() {
  const [ideas, setIdeas] = useState<InstitutionalEmergingIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRisingConviction() {
      try {
        const response = await fetch("/api/evidence/institutional/emerging");
        if (!response.ok) throw new Error("Failed to load institutional evidence");
        const data = (await response.json()) as InstitutionalEmergingResponse;
        if (!cancelled) setIdeas(data.ideas ?? []);
      } catch (err) {
        console.warn("[rising] Failed to load institutional evidence:", err);
        if (!cancelled) setError("Institutional evidence is unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRisingConviction();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <div className="section-header">
        <h2 className="section-title">Rising conviction</h2>
        <span className="section-count">
          {loading ? "..." : `${ideas.length} companies`}
        </span>
      </div>

      <p
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.55rem",
          color: "var(--quiet)",
          marginBottom: 16,
          maxWidth: 520,
        }}
      >
        Watchlist companies where the 15 tracked institutional managers are
        adding or opening positions in the latest SEC 13F filings.
      </p>

      {loading ? (
        <div className="empty-state">
          <p>Reading institutional filings...</p>
        </div>
      ) : error && ideas.length === 0 ? (
        <div className="empty-state">
          <p>{error}</p>
          <small>Add active companies to the watchlist and try again.</small>
        </div>
      ) : ideas.length === 0 ? (
        <div className="empty-state">
          <p>No rising conviction signals right now.</p>
          <small>This section uses 13F accumulation only.</small>
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
                {idea.newPositions > 0 ? (
                  <span className="reason-code positive">
                    + {idea.newPositions} new position{idea.newPositions === 1 ? "" : "s"}
                  </span>
                ) : null}
                {idea.increased > 0 ? (
                  <span className="reason-code positive">
                    + {idea.increased} increase{idea.increased === 1 ? "" : "s"}
                  </span>
                ) : null}
                {idea.reduced > 0 ? (
                  <span className="reason-code negative">
                    − {idea.reduced} reduction{idea.reduced === 1 ? "" : "s"}
                  </span>
                ) : null}
                {idea.exited > 0 ? (
                  <span className="reason-code negative">
                    − {idea.exited} exit{idea.exited === 1 ? "" : "s"}
                  </span>
                ) : null}
              </div>

              <div className="emerging-event">
                <strong>Net share change:</strong>{" "}
                {idea.aggregateShareChange > 0 ? "+" : ""}
                {formatShares(idea.aggregateShareChange)} shares
              </div>
              <div className="emerging-event mt-8">
                <strong>Latest filing:</strong> {idea.latestFilingDate}
              </div>

              {idea.topSignals.length > 0 ? (
                <div className="emerging-event mt-8">
                  <strong>Top evidence:</strong>{" "}
                  {idea.topSignals.map(signalLabel).join("; ")}
                </div>
              ) : null}
              <div className="emerging-event mt-8">
                {idea.newPositions} new position{idea.newPositions === 1 ? "" : "s"} and{" "}
                {idea.increased} manager{idea.increased === 1 ? "" : "s"} increased holdings.
              </div>

              <div className="flex items-center gap-8 mt-8">
                <Link href={`/companies/${idea.ticker}`} className="detail-back">
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
        Powered by SEC EDGAR Form 13F institutional data
      </p>
    </div>
  );
}

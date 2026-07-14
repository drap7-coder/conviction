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

function whyRanked(idea: InstitutionalEmergingIdea) {
  const parts = [];
  if (idea.newPositions) parts.push(`${idea.newPositions} new`);
  if (idea.increased) parts.push(`${idea.increased} increased`);
  if (idea.reduced) parts.push(`${idea.reduced} reduced`);
  if (idea.exited) parts.push(`${idea.exited} exited`);
  return parts.join(" · ");
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
        <h2 className="section-title">Institutional leaderboard</h2>
        <span className="section-count">
          {loading ? "..." : `${ideas.length} companies`}
        </span>
      </div>

      <div className="leaderboard-brief">
        <h1>Who is building conviction?</h1>
        <p>Ranked by new and increased positions among 15 tracked institutional managers.</p>
      </div>

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
        <div className="leaderboard-list">
          {ideas.map((idea, index) => (
            <div key={idea.ticker} className="emerging-card">
              <div className="leaderboard-card-header">
                <span className="leaderboard-rank">#{index + 1}</span>
                <div>
                  <span className="card-ticker">{idea.ticker}</span>
                  <span className="card-name">{idea.name}</span>
                </div>
                <span className="leaderboard-score">{Math.round(idea.score)}</span>
              </div>

              <div className="leaderboard-facts">
                <div>
                  <strong>{idea.newPositions}</strong>
                  <span>new</span>
                </div>
                <div>
                  <strong>{idea.increased}</strong>
                  <span>increased</span>
                </div>
                <div>
                  <strong>{idea.reduced + idea.exited}</strong>
                  <span>reduced/exited</span>
                </div>
              </div>

              <div className="emerging-event">
                <strong>Why ranked:</strong> {whyRanked(idea)}
              </div>
              <div className="emerging-event mt-8">
                <strong>Net shares:</strong>{" "}
                {idea.aggregateShareChange > 0 ? "+" : ""}
                {formatShares(idea.aggregateShareChange)} shares
                {" · "}
                <strong>Latest filing:</strong> {idea.latestFilingDate}
              </div>

              {idea.topSignals.length > 0 ? (
                <div className="leaderboard-signals mt-8">
                  {idea.topSignals.map((signal) => (
                    <span key={`${signal.cik}-${signal.status}-${signal.cusip}`}>
                      {signalLabel(signal)}
                    </span>
                  ))}
                </div>
              ) : null}

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

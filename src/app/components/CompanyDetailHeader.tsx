"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

interface CompanyDetailHeaderProps {
  ticker: string;
  companyName: string;
  sectorName: string | null;
  sectorColors: { c1: string; c2: string } | undefined;
  logoUrl: string | null;
}

/** Identity strip for company detail — price lives in CompanyDetailPrice below the move card. */
export function CompanyDetailHeader({
  ticker,
  companyName,
  sectorName,
  sectorColors,
  logoUrl,
}: CompanyDetailHeaderProps) {
  const [newsCatalyst, setNewsCatalyst] = useState<TodayCatalyst | null>(null);
  const [convictionScore, setConvictionScore] = useState<ConvictionScoreView | null>(null);

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

      <div className="cdh-body cdh-body-identity-only">
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
      </div>
    </div>
  );
}

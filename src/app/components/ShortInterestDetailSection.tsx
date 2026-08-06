"use client";

import { useEffect, useState } from "react";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { inkBoxClass, inkChipClass } from "@/lib/display/ink-tone";

interface ShortInterestRecord {
  ticker: string;
  issueName: string;
  settlementDate: string;
  currentShortShares: number;
  previousShortShares: number;
  changeShares: number;
  changePercent: number;
  averageDailyVolume: number;
  daysToCover: number;
  marketClass: string | null;
  source: "finra-consolidated-short-interest";
}

interface ShortInterestResponse {
  ticker: string;
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
  latest: ShortInterestRecord | null;
  previous: ShortInterestRecord | null;
  message?: string;
  fetchedAt: string;
  source: "finra-consolidated-short-interest" | "timeout" | "error";
}

function formatShares(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatSignedNumber(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/** Detail panel for the Short interest Conviction Signals row. */
export function ShortInterestDetailSection({ ticker }: { ticker: string }) {
  const [summary, setSummary] = useState<ShortInterestResponse | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [requestKey, setRequestKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<ShortInterestResponse>(
          `/api/market/short-interest?ticker=${encodeURIComponent(ticker)}`,
          10_000,
          controller.signal,
        );
        if (cancelled) return;
        setSummary(data);
        if (data.status === "timeout" || data.status === "error" || data.status === "unsupported") {
          setStatus(data.status);
        } else {
          setStatus(data.latest ? "success" : "empty");
        }
      } catch (caught) {
        if (!cancelled) {
          const next = classifyClientError(caught);
          setStatus(next === "idle" ? "error" : next);
          setSummary(null);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker, requestKey]);

  const latest = status === "success" ? summary?.latest ?? null : null;
  const direction = latest
    ? latest.changePercent >= 10 || latest.daysToCover >= 5
      ? "offset"
      : latest.changePercent <= -10
        ? "positive"
        : "neutral"
    : "neutral";

  if (status === "loading" || status === "idle") {
    return (
      <div className={`signal-tile ${inkBoxClass("quiet")}`}>
        <span className="move-eyebrow">FINRA short interest</span>
        <strong className={inkChipClass("quiet")}>Checking</strong>
        <p>Loading the latest consolidated short-interest report.</p>
      </div>
    );
  }

  if (status === "timeout" || status === "error" || status === "unsupported") {
    return (
      <div className={`signal-tile ${inkBoxClass("quiet")}`}>
        <span className="move-eyebrow">FINRA short interest</span>
        <strong className={inkChipClass("quiet")}>Unavailable</strong>
        <p>{summary?.message ?? "Short interest is temporarily unavailable."}</p>
        <button className="retry-button" type="button" onClick={() => setRequestKey((key) => key + 1)}>
          Retry
        </button>
      </div>
    );
  }

  if (!latest) {
    return (
      <div className={`signal-tile ${inkBoxClass("quiet")}`}>
        <span className="move-eyebrow">FINRA short interest</span>
        <strong className={inkChipClass("quiet")}>No record found</strong>
        <p>No FINRA short interest record found for this ticker.</p>
      </div>
    );
  }

  return (
    <div className={`signal-tile ${inkBoxClass(
      direction === "offset" ? "down" : direction === "positive" ? "up" : "quiet",
    )}`}>
      <span className="move-eyebrow">
        Settled {formatDate(latest.settlementDate)} · FINRA
      </span>
      <strong className={inkChipClass(
        direction === "offset" ? "down" : direction === "positive" ? "up" : "quiet",
      )}>
        {direction === "offset"
          ? "Short pressure elevated"
          : direction === "positive"
            ? "Short pressure easing"
            : "Short pressure steady"}
      </strong>
      <div className="short-interest-grid" style={{ marginTop: 10 }}>
        <span>
          Shares short
          <strong>{formatShares(latest.currentShortShares)}</strong>
        </span>
        <span>
          vs prior
          <strong>
            {formatSignedNumber(latest.changeShares)}
            {" · "}
            {latest.changePercent > 0 ? "+" : ""}
            {latest.changePercent.toFixed(2)}%
          </strong>
        </span>
        <span>
          Days to cover
          <strong>{latest.daysToCover.toFixed(2)}</strong>
        </span>
      </div>
    </div>
  );
}

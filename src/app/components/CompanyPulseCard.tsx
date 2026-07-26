"use client";

import { useEffect, useState } from "react";
import { getCompanyPulseCopy } from "@/lib/market/company-pulse";
import type { OpenAttentionPulse } from "@/lib/market/open-attention";
import { cachedFetch } from "@/lib/request-cache";

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatFreshness(value: string): string {
  const elapsedMinutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "just updated";
  return `updated ${elapsedMinutes}m ago`;
}

export function CompanyPulseCard({ ticker }: { ticker: string }) {
  const [pulse, setPulse] = useState<OpenAttentionPulse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const data = await cachedFetch<OpenAttentionPulse>(
          `/api/market/attention?ticker=${encodeURIComponent(ticker)}`,
          { ttl: 5 * 60 * 1000, signal: controller.signal },
        );
        setPulse(data);
      } catch {
        if (!controller.signal.aborted) setPulse(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [ticker]);

  if (loading) {
    return (
      <section className="company-pulse-card company-pulse-loading" aria-label={`${ticker} pulse`} aria-busy="true">
        <div className="company-pulse-heading">
          <div>
            <span className="company-pulse-eyebrow"><i aria-hidden="true" /> Stock pulse · {ticker}</span>
            <h2>Reading open-market attention…</h2>
            <p>Comparing the latest public conversation with this stock’s normal pace.</p>
          </div>
          <span className="company-pulse-status">CHECKING</span>
        </div>
        <div className="company-pulse-metrics" aria-hidden="true">
          {["Velocity", "Posts · 1h", "Voices · 1h", "Price move"].map((label) => (
            <div className="company-pulse-metric" key={label}>
              <span>{label}</span>
              <strong className="company-pulse-placeholder">•••</strong>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const item = pulse?.items[0];
  if (!pulse || !item || pulse.status === "unavailable") {
    return (
      <section className="company-pulse-card pulse-steady" aria-label={`${ticker} pulse`}>
        <div className="company-pulse-heading">
          <div>
            <span className="company-pulse-eyebrow">Stock pulse · {ticker}</span>
            <h2>Pulse is still forming</h2>
            <p>Open-market attention is temporarily unavailable. The rest of the stock story remains current.</p>
          </div>
          <span className="company-pulse-status unavailable">NO SIGNAL</span>
        </div>
        <div className="company-pulse-footer">
          <span>Bluesky public data · 5-minute refresh</span>
          <span>Aggregate attention, not sentiment.</span>
        </div>
      </section>
    );
  }

  const copy = getCompanyPulseCopy(item);
  const priceClass = (item.priceChangePercent ?? 0) > 0
    ? "positive"
    : (item.priceChangePercent ?? 0) < 0 ? "negative" : "";

  return (
    <section className={`company-pulse-card pulse-${copy.tone}`} aria-label={`${ticker} pulse`}>
      <div className="company-pulse-heading">
        <div>
          <span className="company-pulse-eyebrow">Stock pulse · {ticker}</span>
          <h2>{copy.headline}</h2>
          <p>{item.summary}</p>
        </div>
        <span className={`company-pulse-status ${item.confidence}`}>{item.confidence} confidence</span>
      </div>

      <div className="company-pulse-metrics">
        <div className="company-pulse-metric">
          <span>Velocity</span>
          <strong>{item.velocity.toFixed(1)}×</strong>
          <small>vs normal</small>
        </div>
        <div className="company-pulse-metric">
          <span>Posts · 1h</span>
          <strong>{item.mentionsLastHour}</strong>
          <small>{item.accelerationPercent > 0 ? "+" : ""}{item.accelerationPercent}% vs prior hour</small>
        </div>
        <div className="company-pulse-metric">
          <span>Voices · 1h</span>
          <strong>{item.uniqueAuthorsLastHour}</strong>
          <small>unique accounts</small>
        </div>
        <div className="company-pulse-metric">
          <span>Price move</span>
          <strong className={priceClass}>{formatPercent(item.priceChangePercent)}</strong>
          <small>latest session</small>
        </div>
      </div>

      <div className="company-pulse-footer">
        <span>Bluesky public data · {formatFreshness(pulse.fetchedAt)} · 5-minute refresh</span>
        <span>Aggregate attention, not sentiment.</span>
      </div>
    </section>
  );
}

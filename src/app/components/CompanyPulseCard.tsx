"use client";

import { useEffect, useState } from "react";
import { getCompanyPulseCopy } from "@/lib/market/company-pulse";
import type { OpenAttentionPulse } from "@/lib/market/open-attention";
import { cachedFetch } from "@/lib/request-cache";
import { inkBoxClass, inkChipClass, inkToneFromSemantic } from "@/lib/display/ink-tone";

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
      <section className={`company-pulse-card ${inkBoxClass("quiet")} company-pulse-loading`} aria-label={`${ticker} pulse`} aria-busy="true">
        <div className="company-pulse-heading">
          <div>
            <span className="company-pulse-eyebrow"><i aria-hidden="true" /> Stock pulse · {ticker}</span>
            <h2>Reading open-market attention…</h2>
            <p>Comparing the latest public conversation with this stock’s normal pace.</p>
          </div>
          <span className={inkChipClass("quiet")}>Checking</span>
        </div>
        <div className="company-pulse-metrics" aria-hidden="true">
          {["Velocity", "Posts · 1h", "Voices · 1h", "Price move"].map((label) => (
            <div className="company-pulse-metric ink-box ink-box--quiet" key={label}>
              <span className="ink-box-label">{label}</span>
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
      <section className={`company-pulse-card ${inkBoxClass("quiet")}`} aria-label={`${ticker} pulse`}>
        <div className="company-pulse-heading">
          <div>
            <span className="company-pulse-eyebrow">Stock pulse · {ticker}</span>
            <h2>Pulse is still forming</h2>
            <p>Open-market attention is temporarily unavailable. The rest of the stock story remains current.</p>
          </div>
          <span className={inkChipClass("quiet")}>No signal</span>
        </div>
        <div className="company-pulse-footer">
          <span>Bluesky public data · 5-minute refresh</span>
          <span>Aggregate attention, not sentiment.</span>
        </div>
      </section>
    );
  }

  const copy = getCompanyPulseCopy(item);
  const inkTone = inkToneFromSemantic(
    copy.tone === "confirming"
      ? "positive"
      : copy.tone === "cooling"
        ? "negative"
        : copy.tone === "leading"
          ? "contested"
          : "quiet",
  );
  const priceTone = inkToneFromSemantic(
    (item.priceChangePercent ?? 0) > 0
      ? "positive"
      : (item.priceChangePercent ?? 0) < 0
        ? "negative"
        : "quiet",
  );

  return (
    <section className={`company-pulse-card ${inkBoxClass(inkTone)}`} aria-label={`${ticker} pulse`}>
      <div className="company-pulse-heading">
        <div>
          <span className="company-pulse-eyebrow">Stock pulse · {ticker}</span>
          <h2>{copy.headline}</h2>
          <p>{item.summary}</p>
        </div>
        <span className={inkChipClass(inkTone)}>{item.confidence} confidence</span>
      </div>

      <div className="company-pulse-metrics">
        <div className="company-pulse-metric ink-box ink-box--quiet">
          <span className="ink-box-label">Velocity</span>
          <strong>{item.velocity.toFixed(1)}×</strong>
          <small>vs normal</small>
        </div>
        <div className="company-pulse-metric ink-box ink-box--quiet">
          <span className="ink-box-label">Posts · 1h</span>
          <strong>{item.mentionsLastHour}</strong>
          <small>{item.accelerationPercent > 0 ? "+" : ""}{item.accelerationPercent}% vs prior hour</small>
        </div>
        <div className="company-pulse-metric ink-box ink-box--quiet">
          <span className="ink-box-label">Voices · 1h</span>
          <strong>{item.uniqueAuthorsLastHour}</strong>
          <small>unique accounts</small>
        </div>
        <div className={`company-pulse-metric ${inkBoxClass(priceTone)}`}>
          <span className="ink-box-label">Price move</span>
          <strong>{formatPercent(item.priceChangePercent)}</strong>
          <small>{item.sessionLabel ?? "latest session"}</small>
        </div>
      </div>

      <div className="company-pulse-footer">
        <span>Bluesky public data · {formatFreshness(pulse.fetchedAt)} · 5-minute refresh</span>
        <span>Aggregate attention, not sentiment.</span>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import type { PortfolioEvent } from "@/lib/portfolio/event-calendar";
import type { PortfolioRiskXRayResult } from "@/lib/portfolio/risk-xray";

type EventPayload = { events?: PortfolioEvent[]; earningsCoverage?: { complete?: boolean; through?: string } };

function eventDate(at: string): { day: string; date: string } {
  const value = new Date(at);
  return {
    day: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" }).format(value),
    date: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" }).format(value),
  };
}

function exposedTickers(event: PortfolioEvent, risk: PortfolioRiskXRayResult): string[] {
  if (event.ticker) return [event.ticker];
  const tickers = event.relevantFactors.flatMap((id) => risk.factors.find((factor) => factor.id === id)?.drivers.map((driver) => driver.ticker) ?? []);
  return Array.from(new Set(tickers)).slice(0, 4);
}

export function PortfolioEventHud({ tickers, risk }: { tickers: string[]; risk: PortfolioRiskXRayResult }) {
  const tickerKey = useMemo(() => Array.from(new Set(tickers.map((ticker) => ticker.toUpperCase()))).sort().join(","), [tickers]);
  const [payload, setPayload] = useState<EventPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setPayload(null);
    fetch(`/api/market/events?tickers=${encodeURIComponent(tickerKey)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<EventPayload> : Promise.reject(new Error("events unavailable")))
      .then(setPayload)
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [tickerKey]);

  const events = payload?.events ?? [];
  return (
    <section className="pf-event-hud surface-shell" aria-labelledby="pf-event-hud-title">
      <header className="pf-event-hud-head">
        <div><span className="pf-section-eyebrow">Event HUD</span><h2 id="pf-event-hud-title">What can move this book next</h2></div>
        <span>Official macro schedule · Portfolio earnings</span>
      </header>
      {failed ? <p className="pf-event-hud-state">Event coverage is temporarily unavailable. Your portfolio data is unaffected.</p> : !payload ? <p className="pf-event-hud-state">Loading scheduled catalysts…</p> : events.length === 0 ? <p className="pf-event-hud-state">No confirmed events in the current coverage window.</p> : (
        <ol className="pf-event-list">
          {events.map((event) => {
            const when = eventDate(event.at);
            const exposed = exposedTickers(event, risk);
            return <li key={event.id} className={`is-${event.kind}`}>
              <time dateTime={event.at}><b>{when.day}</b><span>{when.date}</span><small>{event.timing}</small></time>
              <div><span className="pf-event-kind">{event.kind === "fed" ? "Fed" : event.kind === "labor" ? "Labor" : event.kind === "inflation" ? "Inflation" : "Earnings"}</span><h3>{event.title}</h3><p>{exposed.length ? `Most exposed here: ${exposed.join(" · ")}` : "Broad portfolio sensitivity"}</p></div>
              <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer">{event.sourceName} ↗</a>
            </li>;
          })}
        </ol>
      )}
      {payload ? <p className="pf-event-hud-note">Earnings checked through {payload.earningsCoverage?.through ?? "the displayed window"}{payload.earningsCoverage?.complete === false ? "; some provider dates were unavailable" : ""}. Scheduled times can change; confirm with the source.</p> : null}
    </section>
  );
}

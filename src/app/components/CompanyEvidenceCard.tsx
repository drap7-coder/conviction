"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import type { StockQuote } from "@/lib/market/types";
import { buildMoveDriverView } from "@/lib/evidence/move-driver-brief";
import {
  buildCompanyEvidenceItem,
  companyEvidenceSignal,
  newsSummaryFromEvents,
} from "@/lib/company/company-evidence-brief";
import type { WatchlistTransition } from "@/components/WatchlistDailyBrief";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { NewsDriverBrief } from "./NewsDriverBrief";
import { SignalBlock } from "@/components/display/SignalBlock";

interface NewsEvidenceResponse {
  events: EvidenceEvent[];
  driver?: NewsDriver | null;
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
}

interface CompanyEvidenceCardProps {
  ticker: string;
  companyName?: string;
  showEmpty?: boolean;
}

function DriverShell({ children }: { children: ReactNode }) {
  return (
    <section className="company-driver-module company-driver-module--flush" aria-label="Company evidence">
      {children}
    </section>
  );
}

export function CompanyEvidenceCard({
  ticker,
  companyName,
  showEmpty = false,
}: CompanyEvidenceCardProps) {
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [driver, setDriver] = useState<NewsDriver | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [transitions, setTransitions] = useState<WatchlistTransition[]>([]);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const [news, quotes, transitionResult] = await Promise.all([
          fetchJsonWithTimeout<NewsEvidenceResponse>(
            `/api/evidence/news?ticker=${encodeURIComponent(ticker)}`,
            8_000,
            controller.signal,
          ),
          fetch(`/api/market/quotes?tickers=${encodeURIComponent(ticker)}`, {
            signal: controller.signal,
          })
            .then((res) => (res.ok ? res.json() as Promise<{ quotes?: StockQuote[] }> : null))
            .catch(() => null),
          fetchJsonWithTimeout<{ transitions?: WatchlistTransition[] }>(
            "/api/conviction/transitions",
            8_000,
            controller.signal,
          ).catch(() => ({ transitions: [] })),
        ]);
        if (cancelled) return;

        setEvents(news.events ?? []);
        setDriver(news.driver ?? null);
        setQuote(quotes?.quotes?.[0] ?? null);
        setTransitions(
          (transitionResult.transitions ?? []).filter(
            (item) => item.ticker.toUpperCase() === ticker.toUpperCase(),
          ),
        );
        setStatus(
          news.status === "timeout" || news.status === "error" || news.status === "unsupported"
            ? news.status
            : (news.events ?? []).length > 0
              ? "success"
              : "empty",
        );
      } catch (caught) {
        if (!cancelled) {
          const next = classifyClientError(caught);
          setStatus(next === "idle" ? "error" : next);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const headlines = useMemo(
    () =>
      events.slice(0, 6).map((event) => ({
        headline: event.title,
        url: event.sourceUrl ?? null,
        date: event.date,
      })),
    [events],
  );
  const news = useMemo(
    () => newsSummaryFromEvents(events, driver),
    [events, driver],
  );
  const absChangePercent = useMemo(() => {
    const change = quote?.changePercent;
    return typeof change === "number" && Number.isFinite(change) ? Math.abs(change) : null;
  }, [quote]);
  const evidenceItem = useMemo(
    () =>
      buildCompanyEvidenceItem({
        ticker,
        companyName: companyName ?? ticker,
        quote,
        news,
        transitions,
      }),
    [ticker, companyName, quote, news, transitions],
  );
  const signal = useMemo(
    () => (evidenceItem ? companyEvidenceSignal(evidenceItem, news) : null),
    [evidenceItem, news],
  );
  const view = useMemo(
    () =>
      buildMoveDriverView({
        ticker,
        companyName,
        driver,
        headlines,
        absChangePercent,
        showBadge: false,
      }),
    [ticker, companyName, driver, headlines, absChangePercent],
  );

  if (status === "loading" || status === "idle") {
    return showEmpty ? (
      <DriverShell>
        <div className="company-catalyst-loading" aria-label="Checking company evidence">
          <span />
          <span />
        </div>
      </DriverShell>
    ) : null;
  }

  if (signal) {
    return (
      <DriverShell>
        <SignalBlock
          eyebrow={signal.eyebrow}
          conclusion={signal.conclusion}
          conclusionHref={signal.conclusionHref}
          evidence={signal.evidence}
          whyItMatters={signal.whyItMatters}
          badge={signal.badge}
          source={signal.source}
          dateLabel={signal.dateLabel}
        >
          {signal.extraHeadlines.length > 0 ? (
            <ol className="signal-block-list" aria-label={`${ticker} related headlines`}>
              {signal.extraHeadlines.map((item) => (
                <li key={`${item.date}-${item.headline}`}>
                  {item.url ? (
                    <a href={item.url} target="_blank" rel="noopener noreferrer">
                      {item.headline}
                    </a>
                  ) : (
                    item.headline
                  )}
                </li>
              ))}
            </ol>
          ) : null}
        </SignalBlock>
      </DriverShell>
    );
  }

  if (status === "timeout" || status === "error") {
    if (absChangePercent == null || absChangePercent < 1) {
      return showEmpty ? (
        <DriverShell>
          <SignalBlock
            conclusion="No fresh company-specific catalyst is confirmed in the current feed."
            hideMeta
          />
        </DriverShell>
      ) : null;
    }
    return (
      <DriverShell>
        <NewsDriverBrief
          ticker={ticker}
          companyName={companyName}
          driver={null}
          headlines={[]}
          absChangePercent={absChangePercent}
          showBadge={false}
          showWhy={false}
          eyebrow={null}
        />
      </DriverShell>
    );
  }

  if (view.mode === "hidden") {
    return showEmpty ? (
      <DriverShell>
        <SignalBlock
          conclusion="No fresh company-specific catalyst is confirmed in the current feed."
          hideMeta
        />
      </DriverShell>
    ) : null;
  }

  return (
    <DriverShell>
      <NewsDriverBrief
        ticker={ticker}
        companyName={companyName}
        driver={driver}
        headlines={headlines}
        absChangePercent={absChangePercent}
        showBadge={false}
        showWhy={false}
        eyebrow={null}
      />
    </DriverShell>
  );
}

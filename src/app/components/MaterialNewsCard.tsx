"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import type { StockQuote } from "@/lib/market/quotes";
import { buildMoveDriverView } from "@/lib/evidence/move-driver-brief";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { NewsDriverBrief } from "./NewsDriverBrief";
import { SignalBlock } from "@/components/display/SignalBlock";
import { fetchMarketQuotes } from "@/lib/market/client-market-data";

interface NewsEvidenceResponse {
  events: EvidenceEvent[];
  driver?: NewsDriver | null;
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
  source?: string;
  message?: string;
}

interface MaterialNewsCardProps {
  ticker: string;
  companyName?: string;
  showEmpty?: boolean;
}

function DriverShell({ children }: { children: ReactNode }) {
  return (
    <section className="company-driver-module company-driver-module--flush" aria-label="Market catalyst">
      {children}
    </section>
  );
}

export function MaterialNewsCard({ ticker, companyName, showEmpty = false }: MaterialNewsCardProps) {
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [driver, setDriver] = useState<NewsDriver | null>(null);
  const [absChangePercent, setAbsChangePercent] = useState<number | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const [news, quotes] = await Promise.all([
          fetchJsonWithTimeout<NewsEvidenceResponse>(
            `/api/evidence/news?ticker=${encodeURIComponent(ticker)}`,
            8_000,
            controller.signal,
          ),
          fetchMarketQuotes([ticker], { reason: "initial", signal: controller.signal }).catch(
            () => [] as StockQuote[],
          ),
        ]);
        if (cancelled) return;

        setEvents(news.events ?? []);
        setDriver(news.driver ?? null);
        const change = quotes[0]?.changePercent;
        setAbsChangePercent(
          typeof change === "number" && Number.isFinite(change) ? Math.abs(change) : null,
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

  const view = useMemo(
    () =>
      buildMoveDriverView({
        ticker,
        companyName,
        driver,
        headlines,
        absChangePercent,
        // Badge lives on CompanyQuoteCard so the headline stays full-width.
        showBadge: false,
      }),
    [ticker, companyName, driver, headlines, absChangePercent],
  );

  // Stay out of the way until we know whether this card should lead.
  if (status === "loading" || status === "idle") {
    return showEmpty ? (
      <DriverShell>
        <div className="company-catalyst-loading" aria-label="Checking company catalysts">
          <span />
          <span />
        </div>
      </DriverShell>
    ) : null;
  }

  // Hard failures: only surface if the session move is meaningful.
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

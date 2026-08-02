"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { NewsDriverBrief } from "./NewsDriverBrief";
import { SignalBlock } from "@/components/display/SignalBlock";

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
}

function DriverShell({ children }: { children: ReactNode }) {
  return (
    <section className="company-driver-module" aria-label="What’s driving the move">
      <div className="company-driver-header">
        <h2 className="company-driver-title">What’s driving the move</h2>
      </div>
      {children}
    </section>
  );
}

export function MaterialNewsCard({ ticker, companyName }: MaterialNewsCardProps) {
  const [events, setEvents] = useState<EvidenceEvent[]>([]);
  const [driver, setDriver] = useState<NewsDriver | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      try {
        const data = await fetchJsonWithTimeout<NewsEvidenceResponse>(
          `/api/evidence/news?ticker=${ticker}`,
          8_000,
          controller.signal,
        );
        if (!cancelled) {
          setEvents(data.events ?? []);
          setDriver(data.driver ?? null);
          setStatus(
            data.status === "timeout" || data.status === "error" || data.status === "unsupported"
              ? data.status
              : (data.events ?? []).length > 0
                ? "success"
                : "empty",
          );
        }
      } catch (caught) {
        if (!cancelled) {
          setStatus(classifyClientError(caught) === "idle" ? "error" : classifyClientError(caught));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const headlines = events.slice(0, 3).map((event) => ({
    headline: event.title,
    url: event.sourceUrl ?? null,
    date: event.date,
  }));

  if (status === "loading" || status === "idle") {
    return (
      <DriverShell>
        <SignalBlock
          eyebrow={ticker}
          conclusion="Reading the latest coverage…"
          evidence="Checking headlines for a clear catalyst."
          hideMeta
        />
      </DriverShell>
    );
  }

  if (status === "timeout" || status === "error") {
    return (
      <DriverShell>
        <SignalBlock
          eyebrow={ticker}
          conclusion="News context is temporarily unavailable"
          evidence="Ownership filings and company disclosures still show the fuller picture."
          hideMeta
        />
      </DriverShell>
    );
  }

  if (!driver && headlines.length === 0) {
    return (
      <DriverShell>
        <SignalBlock
          eyebrow={ticker}
          conclusion="No clear news catalyst found"
          evidence="Ownership filings and company disclosures still show the fuller picture."
          hideMeta
        />
      </DriverShell>
    );
  }

  return (
    <DriverShell>
      <NewsDriverBrief
        ticker={ticker}
        companyName={companyName}
        driver={driver}
        headlines={headlines}
        eyebrow={ticker}
        showBadge
        showWhy={false}
      />
    </DriverShell>
  );
}

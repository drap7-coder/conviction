"use client";

import { useEffect, useState } from "react";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { NewsDriver } from "@/lib/evidence/news-driver";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";
import { NewsDriverBrief } from "./NewsDriverBrief";

interface NewsEvidenceResponse {
  events: EvidenceEvent[];
  driver?: NewsDriver | null;
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
  source?: string;
  message?: string;
}

interface MaterialNewsCardProps {
  ticker: string;
}

export function MaterialNewsCard({ ticker }: MaterialNewsCardProps) {
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

  const copy = status === "loading" || status === "idle"
    ? "Reading the latest coverage…"
    : status === "timeout" || status === "error"
      ? "News context is temporarily unavailable."
      : "No clear news catalyst found.";

  const headlines = events.slice(0, 3).map((event) => ({
    headline: event.title,
    url: event.sourceUrl ?? null,
    date: event.date,
  }));

  return (
    <div className="material-news-briefing">
      {driver || headlines.length > 0 ? (
        <NewsDriverBrief ticker={ticker} driver={driver} headlines={headlines} />
      ) : (
        <p className="material-news-status">{copy}</p>
      )}
    </div>
  );
}

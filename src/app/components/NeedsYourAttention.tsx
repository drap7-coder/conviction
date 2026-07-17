"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { WatchlistEntry, ThesisStatus } from "@/lib/watchlist/types";
import { getPriorityReviewItems, type PriorityReviewItem, normalizeEntryForThesis } from "@/lib/watchlist/priority-review";

interface NeedsYourAttentionProps {
  entries: WatchlistEntry[];
  now?: Date;
}

export function NeedsYourAttention({ entries, now = new Date() }: NeedsYourAttentionProps) {
  const priorityItems = useMemo(() => {
    // Normalize entries to ensure thesis fields are present with defaults
    const normalizedEntries = entries.map(normalizeEntryForThesis);
    return getPriorityReviewItems(normalizedEntries, now);
  }, [entries, now]);

  if (priorityItems.length === 0) {
    return null;
  }

  return (
    <section className="needs-your-attention">
      <div className="section-header">
        <h2 className="section-title">Needs Your Attention</h2>
        <span className="section-count">{priorityItems.length}</span>
      </div>

      <div className="attention-list">
        {priorityItems.map((item) => (
          <AttentionItem key={item.ticker} item={item} />
        ))}
      </div>
    </section>
  );
}

interface AttentionItemProps {
  item: PriorityReviewItem;
}

function AttentionItem({ item }: AttentionItemProps) {
  const { ticker, companyName, thesis, status, reviewAt, reason } = item;

  const statusColorClass = getStatusColorClass(status);
  const thesisExcerpt = thesis.length > 60 ? `${thesis.slice(0, 60)}...` : thesis;

  return (
    <div className="attention-item">
      <div className="attention-item-header">
        <Link href={`/companies/${ticker}`} className="attention-ticker">
          {ticker}
        </Link>
        <span className={`attention-status ${statusColorClass}`}>{status}</span>
      </div>

      <p className="attention-thesis">{thesisExcerpt || "No thesis recorded"}</p>

      <div className="attention-details">
        <span className="attention-reason">{reason}</span>
        {reviewAt && (
          <span className="attention-review-date">
            Review by {new Date(reviewAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

function getStatusColorClass(status: ThesisStatus): string {
  switch (status) {
    case "broken":
      return "attention-status-broken";
    case "weakening":
      return "attention-status-weakening";
    case "review":
      return "attention-status-review";
    case "supported":
      return "attention-status-supported";
    case "building":
    default:
      return "attention-status-building";
  }
}
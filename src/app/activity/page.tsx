"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";

interface ActivityEvent {
  id: string;
  ticker: string;
  company_name: string;
  event_type: string;
  severity: "high" | "medium" | "low";
  headline: string;
  description: string;
  source_url: string | null;
  source: string;
  created_at: string;
  is_read: boolean;
  is_dismissed: boolean;
}

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = Date.now();
  const diff = now - d.getTime();
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days === 0) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    if (hours === 0) {
      const mins = Math.floor(diff / (60 * 1000));
      return `${Math.max(1, mins)}m ago`;
    }
    return `${hours}h ago`;
  }
  if (days === 1) return "1d ago";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function severityLabel(severity: string) {
  switch (severity) {
    case "high": return "High";
    case "medium": return "Medium";
    default: return "Low";
  }
}

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEvent[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchJsonWithTimeout<{
        authenticated: boolean;
        entries: ActivityEvent[];
        unreadCount: number;
      }>("/api/activity", 10_000);

      setAuthenticated(data.authenticated);
      setEntries(data.entries ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      setAuthenticated(false);
      setEntries([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFeed(); }, [loadFeed]);

  const handleMarkRead = async (eventId: string) => {
    try {
      await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markRead", eventId }),
      });
      setEntries((prev) => prev.map((e) => e.id === eventId ? { ...e, is_read: true } : e));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // best-effort
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markAllRead" }),
      });
      setEntries((prev) => prev.map((e) => ({ ...e, is_read: true })));
      setUnreadCount(0);
    } catch {
      // best-effort
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDismiss = async (eventId: string) => {
    try {
      await fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", eventId }),
      });
      setEntries((prev) => prev.filter((e) => e.id !== eventId));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // best-effort
    }
  };

  if (!authenticated) {
    return (
      <div>
        <div className="section-header">
          <h2 className="section-title">Activity</h2>
        </div>
        <div className="empty-state">
          <p>Sign in to see conviction activity for your watchlist.</p>
          <small className="mt-8 block" style={{ marginTop: 12 }}>
            Coming soon.
          </small>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="section-header activity-header">
        <h2 className="section-title">Activity</h2>
        <div className="activity-header-actions">
          {unreadCount > 0 && (
            <span className="section-count">{unreadCount} unread</span>
          )}
          {entries.length > 0 && unreadCount > 0 && (
            <button
              type="button"
              className="activity-action"
              onClick={handleMarkAllRead}
              disabled={markingAll}
            >
              {markingAll ? "Marking..." : "Mark all read"}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="empty-state">
          <p>Loading activity...</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <p>No conviction activity yet.</p>
          <small>
            Activity appears here when tracked companies show conviction changes,
            new signals, or expired evidence.
          </small>
        </div>
      ) : (
        <div className="activity-feed">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={`activity-row ${entry.is_read ? "read" : "unread"}`}
            >
              <div className="activity-row-main">
                <div className="activity-row-top">
                  <Link
                    href={`/companies/${entry.ticker}`}
                    className="activity-ticker"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMarkRead(entry.id);
                    }}
                  >
                    {entry.ticker}
                  </Link>
                  <span className={`activity-severity activity-severity-${entry.severity}`}>
                    {severityLabel(entry.severity)}
                  </span>
                  <span className="activity-time">{formatTime(entry.created_at)}</span>
                </div>
                <p className="activity-headline">{entry.headline}</p>
                {entry.description && (
                  <p className="activity-description">{entry.description}</p>
                )}
              </div>
              <div className="activity-row-actions">
                {!entry.is_read && (
                  <button
                    type="button"
                    className="activity-action subtle"
                    onClick={() => handleMarkRead(entry.id)}
                    aria-label="Mark as read"
                    title="Mark as read"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  className="activity-action subtle"
                  onClick={() => handleDismiss(entry.id)}
                  aria-label="Dismiss"
                  title="Dismiss"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
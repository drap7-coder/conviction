"use client";

import { useEffect, useState } from "react";
import { InvestorMovesPanel } from "@/app/components/InvestorMovesPanel";
import { PoliticiansMovesPanel } from "@/app/components/PoliticiansMovesPanel";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";

const SMART_MONEY_VIEWS = [
  {
    id: "institutions",
    label: "Institutions",
    description: "13F ownership moves",
  },
  {
    id: "politicians",
    label: "Politicians",
    description: "STOCK Act disclosures",
  },
] as const;

type SmartMoneyView = (typeof SMART_MONEY_VIEWS)[number]["id"];

interface WatchlistEntry {
  ticker: string;
  companyName: string;
  addedAt: string;
  status: "active" | "unsupported" | "error";
}

interface WatchlistCandidate {
  ticker: string;
  companyName: string;
}

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

function readBrowserWatchlist(): WatchlistEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is WatchlistEntry =>
      typeof entry?.ticker === "string" &&
      typeof entry?.companyName === "string" &&
      typeof entry?.addedAt === "string" &&
      ["active", "unsupported", "error"].includes(entry?.status),
    );
  } catch {
    return [];
  }
}

function writeBrowserWatchlist(entries: WatchlistEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // best-effort
  }
}

export default function SmartMoneyPage() {
  const [activeView, setActiveView] = useState<SmartMoneyView>("institutions");
  const [trackedTickers, setTrackedTickers] = useState<Set<string>>(new Set());
  const [addingTicker, setAddingTicker] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadWatchlist() {
      try {
        const data = await fetchJsonWithTimeout<{
          authenticated?: boolean;
          entries?: WatchlistEntry[];
          guestEntries?: WatchlistEntry[];
        }>("/api/watchlist", 8_000, controller.signal);
        if (cancelled) return;
        const entries = data.authenticated
          ? data.entries ?? []
          : data.guestEntries ?? data.entries ?? [];
        setTrackedTickers(new Set(entries.map((entry) => entry.ticker)));
      } catch {
        if (!cancelled) setTrackedTickers(new Set());
      }
    }

    void loadWatchlist();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const handleAdd = async (idea: WatchlistCandidate) => {
    setAddingTicker(idea.ticker);
    try {
      const response = await fetch("/api/watchlist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: idea.ticker }),
      });
      const data = await response.json();
      if (!data.success) return;
      setTrackedTickers((current) => new Set([...current, data.added?.ticker ?? idea.ticker]));
      if (data.persistence === "browser" && data.added) {
        const currentEntries = readBrowserWatchlist();
        writeBrowserWatchlist([
          ...currentEntries.filter((entry) => entry.ticker !== data.added.ticker),
          data.added as WatchlistEntry,
        ]);
      }
    } finally {
      setAddingTicker(null);
    }
  };

  return (
    <div className="smart-money-page">
      <section className="view-switch-shell" aria-label="Smart Money">
        <div className="view-switch-lede market-regime-lede ink-panel">
          <span className="market-regime-eyebrow">Smart Money</span>
          <strong className="market-regime-label">Where capital is being put to work</strong>
        </div>

        <div className="view-switch-picker pulse-view-picker">
          <div
            className="pulse-view-tabs"
            role="tablist"
            aria-label="Choose a Smart Money view"
          >
            {SMART_MONEY_VIEWS.map((view) => (
              <button
                key={view.id}
                id={`smart-money-tab-${view.id}`}
                type="button"
                role="tab"
                aria-label={`${view.label}: ${view.description}`}
                aria-selected={activeView === view.id}
                aria-controls={`smart-money-panel-${view.id}`}
                className={activeView === view.id ? "active" : ""}
                onClick={() => setActiveView(view.id)}
              >
                <strong>{view.label}</strong>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div
        id="smart-money-panel-institutions"
        role="tabpanel"
        aria-labelledby="smart-money-tab-institutions"
        hidden={activeView !== "institutions"}
      >
        {activeView === "institutions" ? (
          <InvestorMovesPanel
            trackedTickers={trackedTickers}
            addingTicker={addingTicker}
            onAdd={handleAdd}
          />
        ) : null}
      </div>

      <div
        id="smart-money-panel-politicians"
        role="tabpanel"
        aria-labelledby="smart-money-tab-politicians"
        hidden={activeView !== "politicians"}
      >
        {activeView === "politicians" ? <PoliticiansMovesPanel /> : null}
      </div>
    </div>
  );
}

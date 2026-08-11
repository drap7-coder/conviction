"use client";

import { useEffect, useState } from "react";
import { InvestorMovesPanel } from "@/app/components/InvestorMovesPanel";
import { PoliticiansMovesPanel } from "@/app/components/PoliticiansMovesPanel";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { ViewSwitcher } from "@/components/ViewSwitcher";

const SMART_MONEY_VIEWS = [
  {
    id: "institutions",
    label: "Institutions",
    tabId: "smart-money-tab-institutions",
    panelId: "smart-money-panel-institutions",
  },
  {
    id: "politicians",
    label: "Politicians",
    tabId: "smart-money-tab-politicians",
    panelId: "smart-money-panel-politicians",
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
      <section className="product-stage product-stage--smart-money" aria-label="Smart Money overview">
        <div className="product-stage-copy">
          <span className="product-stage-eyebrow">
            <i aria-hidden="true" /> Smart Money · Filed evidence
          </span>
          <h1>Watch what power does.</h1>
          <p>
            Follow institutional ownership and congressional disclosures—the actions behind the opinions.
          </p>
        </div>
        <div className="product-stage-metrics product-stage-metrics--text" aria-label="Available evidence">
          <div>
            <strong>13F</strong>
            <span>Institutions</span>
          </div>
          <div>
            <strong>STOCK</strong>
            <span>Politicians</span>
          </div>
          <div>
            <strong>Filed</strong>
            <span>Not forecast</span>
          </div>
        </div>
      </section>

      <ViewSwitcher
        label="Choose a Smart Money view"
        options={[...SMART_MONEY_VIEWS]}
        activeId={activeView}
        onChange={(id) => setActiveView(id as SmartMoneyView)}
      />

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
        {activeView === "politicians" ? (
          <PoliticiansMovesPanel
            trackedTickers={trackedTickers}
            addingTicker={addingTicker}
            onAdd={handleAdd}
          />
        ) : null}
      </div>
    </div>
  );
}

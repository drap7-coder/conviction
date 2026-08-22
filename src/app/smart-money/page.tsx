"use client";

import { useState } from "react";
import { InvestorBookPanel } from "@/app/components/InvestorBookPanel";
import { PoliticiansMovesPanel } from "@/app/components/PoliticiansMovesPanel";
import { useWatchlistTracking } from "@/app/components/use-watchlist-tracking";
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

export default function SmartMoneyPage() {
  const [activeView, setActiveView] = useState<SmartMoneyView>("institutions");
  const { trackedTickers, addingTicker, addToWatchlist } = useWatchlistTracking();

  return (
    <main className="smart-money-page">
      <h1 className="sr-only">Smart Money</h1>
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
          <InvestorBookPanel
            trackedTickers={trackedTickers}
            addingTicker={addingTicker}
            onAdd={addToWatchlist}
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
            onAdd={addToWatchlist}
          />
        ) : null}
      </div>
    </main>
  );
}

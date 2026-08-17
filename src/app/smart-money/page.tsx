"use client";

import { useState } from "react";
import { InvestorBookPanel } from "@/app/components/InvestorBookPanel";
import { PoliticiansMovesPanel } from "@/app/components/PoliticiansMovesPanel";
import { useWatchlistTracking } from "@/app/components/use-watchlist-tracking";
import { ProductStage } from "@/components/ProductStage";
import { ViewSwitcher } from "@/components/ViewSwitcher";
import type { SmartMoneyStageSummary } from "@/lib/market/smart-money-stage";

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

const INITIAL_INSTITUTION_SUMMARY: SmartMoneyStageSummary = {
  headline: "What funds filed.",
  summary: "Choose a manager. Read the latest quarter against the one before it.",
  tone: "neutral",
  metrics: [
    { label: "New / added", value: "—", tone: "positive" },
    { label: "Trimmed / exited", value: "—", tone: "negative" },
    { label: "Holdings", value: "—" },
  ],
};

const INITIAL_POLITICIAN_SUMMARY: SmartMoneyStageSummary = {
  headline: "What they traded.",
  summary: "Recent STOCK Act disclosures. Filing date can trail the trade.",
  tone: "neutral",
  metrics: [
    { label: "Buys", value: "—", tone: "positive" },
    { label: "Sells", value: "—", tone: "negative" },
    { label: "Median lag", value: "—" },
  ],
};

export default function SmartMoneyPage() {
  const [activeView, setActiveView] = useState<SmartMoneyView>("institutions");
  const [institutionSummary, setInstitutionSummary] = useState(INITIAL_INSTITUTION_SUMMARY);
  const [politicianSummary, setPoliticianSummary] = useState(INITIAL_POLITICIAN_SUMMARY);
  const { trackedTickers, addingTicker, addToWatchlist } = useWatchlistTracking();
  const activeSummary = activeView === "institutions" ? institutionSummary : politicianSummary;

  return (
    <div className="smart-money-page">
      <ViewSwitcher
        label="Choose a Smart Money view"
        options={[...SMART_MONEY_VIEWS]}
        activeId={activeView}
        onChange={(id) => setActiveView(id as SmartMoneyView)}
      />

      <ProductStage
        variant="smart-money"
        aria-label="Smart Money overview"
        eyebrow={activeView === "institutions" ? "Smart Money · 13F filings" : "Smart Money · STOCK Act filings"}
        headline={activeSummary.headline}
        summary={activeSummary.summary}
        tone={activeSummary.tone}
        metrics={
          <>
            {activeSummary.metrics.map((metric) => (
              <div
                key={metric.label}
                className={
                  metric.tone === "positive"
                    ? "is-positive"
                    : metric.tone === "negative"
                      ? "is-negative"
                      : metric.tone === "alert"
                        ? "is-alert"
                        : undefined
                }
              >
                <strong>{metric.value}</strong>
                <span>{metric.label}</span>
              </div>
            ))}
          </>
        }
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
            onSummaryChange={setInstitutionSummary}
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
            onSummaryChange={setPoliticianSummary}
          />
        ) : null}
      </div>
    </div>
  );
}

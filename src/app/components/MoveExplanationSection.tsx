"use client";

import { useEffect, useState } from "react";
import { buildConvictionHeader } from "@/lib/conviction/header";
import type { MoveEvent } from "@/lib/evidence/move-events";
import type { EvidenceEvent } from "@/lib/evidence/types";
import type { PoliticalTradeSummary } from "@/lib/political-trades";
import type { InstitutionalAccumulation } from "@/lib/sec/institutional";
import {
  type CorporateDisclosureSummary,
} from "@/lib/sec/corporate-disclosures";
import { summarizeCorporateEventActivity } from "@/lib/sec/corporate-disclosure-activity";
import type { MajorOwnershipSummary } from "@/lib/sec/major-ownership";
import { getPeerTickers } from "@/lib/market/peers";
import { classifyClientError, fetchJsonWithTimeout, type EvidenceStatus } from "./evidence-request";

interface MoveExplanationSectionProps {
  ticker: string;
}

interface InstitutionalResponse {
  results: InstitutionalAccumulation[];
  status?: "success" | "timeout" | "error";
  message?: string;
}

interface InsiderResponse {
  events: EvidenceEvent[];
}

type PoliticalResponse = PoliticalTradeSummary;
type DisclosureResponse = Omit<CorporateDisclosureSummary, "status" | "source"> & {
  status: CorporateDisclosureSummary["status"] | "timeout" | "error";
  source: CorporateDisclosureSummary["source"] | "timeout" | "error";
  message?: string;
};
type OwnershipResponse = Omit<MajorOwnershipSummary, "status" | "source"> & {
  status: MajorOwnershipSummary["status"] | "timeout" | "error";
  source: MajorOwnershipSummary["source"] | "timeout" | "error";
  message?: string;
};

interface StockQuote {
  ticker: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
}

interface ShortInterestRecord {
  ticker: string;
  issueName: string;
  settlementDate: string;
  currentShortShares: number;
  previousShortShares: number;
  changeShares: number;
  changePercent: number;
  averageDailyVolume: number;
  daysToCover: number;
  marketClass: string | null;
  source: "finra-consolidated-short-interest";
}

interface ShortInterestResponse {
  ticker: string;
  status?: "success" | "empty" | "unsupported" | "timeout" | "error";
  latest: ShortInterestRecord | null;
  previous: ShortInterestRecord | null;
  message?: string;
  fetchedAt: string;
  source: "finra-consolidated-short-interest" | "timeout" | "error";
}

function confidenceLabel(confidence: MoveEvent["confidence"]) {
  if (confidence === "high") return "High confidence";
  if (confidence === "medium") return "Medium confidence";
  return "Low confidence";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function formatShares(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatSignedNumber(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function describeStatus(row: InstitutionalAccumulation) {
  if (row.status === "New") return "opened";
  if (row.status === "Increased") return "increased";
  if (row.status === "Reduced") return "reduced";
  if (row.status === "Exited") return "exited";
  return "held";
}

function summarizeInstitutional(rows: InstitutionalAccumulation[], ticker: string) {
  const activeRows = rows.filter((row) => row.status !== "Unchanged");
  const positiveRows = activeRows.filter((row) => row.status === "New" || row.status === "Increased");
  const negativeRows = activeRows.filter((row) => row.status === "Reduced" || row.status === "Exited");
  const lead = positiveRows[0] ?? negativeRows[0] ?? activeRows[0];
  const latestFilingDate = activeRows
    .map((row) => row.filingDate)
    .sort((a, b) => b.localeCompare(a))[0];

  if (!activeRows.length) {
    return {
      activeRows,
      lead,
      latestFilingDate: latestFilingDate ?? null,
      label: "No tracked 13F change found",
      text: "No activity found among the 15 tracked institutional managers.",
      tone: "neutral",
    };
  }

  const label = positiveRows.length > 0 && negativeRows.length > 0
    ? "Mixed 13F signal"
    : positiveRows.length > 0
      ? "Supporting 13F signal"
      : "Counter 13F signal";
  const text = lead
    ? `${lead.displayName} ${describeStatus(lead)} ${ticker}: ${formatShares(Math.abs(lead.shareChange))} share${Math.abs(lead.shareChange) === 1 ? "" : "s"} changed${latestFilingDate ? `, filed ${latestFilingDate}` : ""}.`
    : `${activeRows.length} tracked-manager changes${latestFilingDate ? `, latest filed ${latestFilingDate}` : ""}.`;

  return {
    activeRows,
    lead,
    latestFilingDate: latestFilingDate ?? null,
    label,
    text,
    tone: positiveRows.length > 0 && negativeRows.length > 0
      ? "neutral"
      : positiveRows.length > 0
        ? "positive"
        : "negative",
  };
}

function daysSince(value: string) {
  const then = new Date(`${value}T12:00:00`).getTime();
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY;
  return Math.floor((Date.now() - then) / (24 * 60 * 60 * 1000));
}

function formatMoney(value: number | null | undefined) {
  if (!value) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${(value / 1_000).toFixed(0)}K`;
}

function summarizeInsiders(events: EvidenceEvent[]) {
  const recentEvents = events.filter((event) => daysSince(event.date) <= 90);
  const purchases = recentEvents.filter((event) => event.metadata?.transactionType === "purchase");
  const sales = recentEvents.filter((event) => event.metadata?.transactionType === "sale");
  const leadPurchase = purchases[0] ?? null;
  const leadSale = sales[0] ?? null;

  return {
    purchases,
    sales,
    leadPurchase,
    leadSale,
  };
}

export function MoveExplanationSection({ ticker }: MoveExplanationSectionProps) {
  const [event, setEvent] = useState<MoveEvent | null>(null);
  const [institutionalRows, setInstitutionalRows] = useState<InstitutionalAccumulation[]>([]);
  const [insiderEvents, setInsiderEvents] = useState<EvidenceEvent[]>([]);
  const [politicalSummary, setPoliticalSummary] = useState<PoliticalResponse | null>(null);
  const [shortInterestSummary, setShortInterestSummary] = useState<ShortInterestResponse | null>(null);
  const [disclosureSummary, setDisclosureSummary] = useState<DisclosureResponse | null>(null);
  const [ownershipSummary, setOwnershipSummary] = useState<OwnershipResponse | null>(null);
  const [institutionalStatus, setInstitutionalStatus] = useState<EvidenceStatus>("idle");
  const [shortInterestStatus, setShortInterestStatus] = useState<EvidenceStatus>("idle");
  const [disclosureStatus, setDisclosureStatus] = useState<EvidenceStatus>("idle");
  const [ownershipStatus, setOwnershipStatus] = useState<EvidenceStatus>("idle");
  const [quotes, setQuotes] = useState<Record<string, StockQuote>>({});
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      setStatus("loading");
      setInstitutionalStatus("loading");
      setShortInterestStatus("loading");
      setDisclosureStatus("loading");
      setOwnershipStatus("loading");
      setError(null);
      try {
        const peerTickers = getPeerTickers(ticker);
        const quoteTickers = [ticker, ...peerTickers].join(",");
        const moveData = await fetchJsonWithTimeout<MoveEvent>(
          `/api/evidence/move?ticker=${ticker}`,
          8_000,
          controller.signal,
        );

        const [institutionalResult, insiderResult, politicalResult, quoteResult, ownershipResult, disclosureResult, shortInterestResult] = await Promise.allSettled([
          fetchJsonWithTimeout<InstitutionalResponse>(`/api/evidence/institutional?ticker=${ticker}`, 26_000, controller.signal),
          fetchJsonWithTimeout<InsiderResponse>(`/api/evidence/insider?ticker=${ticker}`, 14_000, controller.signal),
          fetchJsonWithTimeout<PoliticalResponse>(`/api/evidence/political?ticker=${ticker}`, 10_000, controller.signal),
          fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(`/api/market/quotes?tickers=${encodeURIComponent(quoteTickers)}`, 8_000, controller.signal),
          fetchJsonWithTimeout<OwnershipResponse>(`/api/evidence/ownership?ticker=${ticker}`, 10_000, controller.signal),
          fetchJsonWithTimeout<DisclosureResponse>(`/api/evidence/disclosures?ticker=${ticker}`, 10_000, controller.signal),
          fetchJsonWithTimeout<ShortInterestResponse>(`/api/market/short-interest?ticker=${ticker}`, 10_000, controller.signal),
        ]);

        const institutionalData = institutionalResult.status === "fulfilled"
          ? institutionalResult.value
          : { results: [], status: classifyClientError(institutionalResult.reason) };
        const insiderData = insiderResult.status === "fulfilled"
          ? insiderResult.value
          : { events: [] };
        const politicalData = politicalResult.status === "fulfilled" ? politicalResult.value : null;
        const quoteData = quoteResult.status === "fulfilled" ? quoteResult.value : { quotes: [] };
        const ownershipData = ownershipResult.status === "fulfilled"
          ? ownershipResult.value
          : null;
        const disclosureData = disclosureResult.status === "fulfilled"
          ? disclosureResult.value
          : null;
        const shortInterestData = shortInterestResult.status === "fulfilled"
          ? shortInterestResult.value
          : { latest: null, previous: null, status: classifyClientError(shortInterestResult.reason) };

        if (!cancelled) {
          const quoteMap: Record<string, StockQuote> = {};
          for (const quote of quoteData.quotes ?? []) quoteMap[quote.ticker] = quote;
          setEvent(moveData);
          setInstitutionalRows(institutionalData.results ?? []);
          setInstitutionalStatus(
            institutionalData.status === "timeout" || institutionalData.status === "error"
              ? institutionalData.status
              : (institutionalData.results ?? []).length > 0
                ? "success"
                : "empty",
          );
          setInsiderEvents(insiderData.events ?? []);
          setPoliticalSummary(politicalData);
          setShortInterestSummary(shortInterestData as ShortInterestResponse);
          setShortInterestStatus(
            shortInterestData.status === "timeout" || shortInterestData.status === "error" || shortInterestData.status === "unsupported"
              ? shortInterestData.status
              : shortInterestData.latest
                ? "success"
                : "empty",
          );
          setOwnershipSummary(ownershipData);
          setOwnershipStatus(
            ownershipData?.status === "timeout" || ownershipData?.status === "error"
              ? ownershipData.status
              : ownershipData?.status === "unsupported"
                ? "unsupported"
                : ownershipData?.status === "success"
                  ? "success"
                  : "empty",
          );
          setDisclosureSummary(disclosureData);
          setDisclosureStatus(
            disclosureData?.status === "timeout" || disclosureData?.status === "error"
              ? disclosureData.status
              : disclosureData?.status === "unsupported"
                ? "unsupported"
                : disclosureData?.status === "success"
                  ? "success"
                  : "empty",
          );
          setQuotes(quoteMap);
          setStatus("success");
        }
      } catch (caught) {
        if (!cancelled) {
          const nextStatus = classifyClientError(caught);
          setStatus(nextStatus === "idle" ? "error" : nextStatus);
          setError(nextStatus === "timeout"
            ? "Move evidence is temporarily unavailable."
            : nextStatus === "unsupported"
              ? "This issuer is not currently supported."
              : "Move explanation unavailable.");
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [ticker]);

  const isFallback = event?.category === "no-clear-catalyst";
  const institutional = summarizeInstitutional(institutionalRows, ticker);
  const institutionalText = institutionalStatus === "timeout" || institutionalStatus === "error"
    ? "Institutional filing data is temporarily unavailable. Retry later."
    : institutional.text;
  const insider = summarizeInsiders(insiderEvents);
  const latestDisclosure = disclosureStatus === "success" ? disclosureSummary?.latestDisclosure ?? null : null;
  const corporateActivity = disclosureStatus === "success" ? summarizeCorporateEventActivity(disclosureSummary?.corporateEvents ?? []) : null;
  const shortInterest = shortInterestStatus === "success" ? shortInterestSummary?.latest ?? null : null;
  const header = buildConvictionHeader({
    institutionalRows,
    insiderEvents,
    politicalSummary,
    shortInterest,
    corporateActivity,
  });
  const institutionalPositive = header.supportingSignals.some((signal) => signal.kind === "institutional");
  const hasRecentInsiderBuy = header.supportingSignals.some((signal) => signal.kind === "insider");
  const politicalPurchase = politicalSummary?.purchases[0] ?? null;
  const politicalSale = politicalSummary?.sales[0] ?? null;
  const hasPoliticalPurchase = header.supportingSignals.some((signal) => signal.kind === "political");
  const hasInsiderOffset = header.offsets.some((signal) => signal.kind === "insider");
  const hasPoliticalOffset = header.offsets.some((signal) => signal.kind === "political");
  const hasCounterSignal = hasInsiderOffset || hasPoliticalOffset;
  const headerTone = header.status === "monitor" ? "neutral" : "positive";
  const headerBadge = header.status === "broad"
    ? "Broad alignment"
    : header.status === "multi"
      ? "Aligned signals"
      : header.status === "institutional"
        ? "13F signal"
        : header.status === "watch"
          ? "Watch signal"
          : "No alignment";
  const quote = quotes[ticker];
  const ownershipFilings = ownershipStatus === "success" ? ownershipSummary?.filings.slice(0, 3) ?? [] : [];
  const shortInterestDirection = shortInterest
    ? shortInterest.changePercent >= 10 || shortInterest.daysToCover >= 5
      ? "offset"
      : shortInterest.changePercent <= -10
        ? "positive"
        : "neutral"
    : "neutral";
  const shortInterestCopy = shortInterestStatus === "loading" || shortInterestStatus === "idle"
    ? "Checking FINRA short interest."
    : shortInterestStatus === "timeout" || shortInterestStatus === "error"
      ? "Short interest is temporarily unavailable."
      : shortInterest
        ? `${formatShares(shortInterest.currentShortShares)} shares short, ${formatSignedNumber(shortInterest.changeShares)} from prior report.`
        : "No FINRA short interest record found.";
  const ownershipCopy = ownershipStatus === "loading" || ownershipStatus === "idle"
    ? "Checking SEC 13D and 13G filings."
    : ownershipStatus === "timeout" || ownershipStatus === "error"
      ? "SEC major ownership filings are temporarily unavailable."
      : ownershipFilings.length > 0
        ? `${ownershipFilings.length} latest major ownership filing${ownershipFilings.length === 1 ? "" : "s"} found.`
        : "No 13D or 13G filings found.";
  const hasLeadershipChangeCluster = header.offsets.some((signal) => signal.kind === "management");
  const disclosureCopy = disclosureStatus === "loading" || disclosureStatus === "idle"
    ? "Checking recent SEC filings."
    : disclosureStatus === "timeout" || disclosureStatus === "error"
      ? "SEC corporate disclosures are temporarily unavailable."
      : latestDisclosure
        ? `${latestDisclosure.title}. Filed ${formatDate(latestDisclosure.filingDate)}.`
        : "No recent SEC corporate disclosures.";
  const latestKnownEvent = latestDisclosure
      ? {
          title: latestDisclosure.title,
          detail: `${formatDate(latestDisclosure.filingDate)} · ${latestDisclosure.summary}`,
        }
      : null;
  const peerQuotes = getPeerTickers(ticker)
    .map((peerTicker) => quotes[peerTicker])
    .filter((peerQuote): peerQuote is StockQuote => !!peerQuote);

  return (
    <section className="move-section">
      <div className="section-header mt-16">
        <h2 className="section-title">Move context</h2>
        <span className="section-count">Catalyst + signals</span>
      </div>

      {status === "loading" || status === "idle" ? (
        <div className="detail-build-panel" aria-live="polite">
          <div className="move-card loading detail-build-hero">
            <div>
              <span className="move-eyebrow">Building evidence</span>
              <h3>Checking primary-source conviction signals.</h3>
              <p>SEC filings, short interest, market context, and sourced catalysts are loading.</p>
            </div>
            <div className="rising-build-meter" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="detail-build-grid" aria-hidden="true">
            {["13F managers", "Form 4 insiders", "FINRA shorts", "SEC 8-K events"].map((label) => (
              <div className="rising-build-card detail-build-card" key={label}>
                <span className="rising-scan-line" />
                <span className="move-eyebrow">{label}</span>
                <div className="rising-build-row">
                  <span className="rising-build-chip" />
                  <span className="rising-build-title" />
                  <span className="rising-build-score" />
                </div>
                <div className="rising-build-facts">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="rising-build-copy" />
                <span className="rising-build-copy short" />
              </div>
            ))}
          </div>
        </div>
      ) : error ? (
        <div className="move-card">
          <h3>{error}</h3>
          <p className="move-answer">Data is not available at this moment. Retry in a moment.</p>
        </div>
      ) : event ? (
        <div className={`move-card convergence-card convergence-${header.status} confidence-${event.confidence}`}>
          <div className="move-card-top">
            <div>
              <span className="move-eyebrow">{formatDate(event.date)}</span>
              <h3>{header.headline}</h3>
              <p className="convergence-detail">{header.reason}</p>
            </div>
            <span className={`move-confidence convergence-badge ${headerTone}`}>
              {headerBadge}
            </span>
          </div>

          <div className="convergence-signal-grid" aria-label="Conviction signals">
            <div className={institutionalPositive ? "signal-tile positive" : "signal-tile neutral"}>
              <span className="move-eyebrow">Institutional</span>
              <strong>
                {institutionalStatus === "timeout" || institutionalStatus === "error"
                  ? "Data unavailable"
                  : institutionalPositive
                    ? "Accumulating"
                    : "No accumulation"}
              </strong>
              <p>{institutionalText}</p>
            </div>
            <div className={hasRecentInsiderBuy ? "signal-tile positive" : "signal-tile neutral"}>
              <span className="move-eyebrow">Insider</span>
              <strong>{hasRecentInsiderBuy ? "Open-market buying" : "No recent open-market buy"}</strong>
              <p>
                {insider.leadPurchase
                  ? `${insider.leadPurchase.metadata?.insiderName ?? "Insider"} bought ${insider.leadPurchase.metadata?.shares?.toLocaleString() ?? "shares"}${formatMoney(insider.leadPurchase.metadata?.totalValue) ? ` / ${formatMoney(insider.leadPurchase.metadata?.totalValue)}` : ""}.`
                  : "Grants, tax withholding, and option exercises do not count as conviction."}
              </p>
            </div>
            <div className={hasPoliticalPurchase ? "signal-tile positive" : "signal-tile neutral"}>
              <span className="move-eyebrow">Political</span>
              <strong>{hasPoliticalPurchase ? "Disclosed purchase" : "No political purchase"}</strong>
              <p>
                {politicalPurchase
                  ? `${politicalPurchase.filerName} reported a ${politicalPurchase.amountRange} purchase, filed ${formatDate(politicalPurchase.filingDate)}.`
                  : "Political sales and exchanges do not count as positive conviction."}
              </p>
            </div>
            <div className={`signal-tile ${shortInterestDirection}`}>
              <span className="move-eyebrow">Short interest</span>
              <strong>
                {shortInterest
                  ? shortInterestDirection === "offset"
                    ? "Short pressure elevated"
                    : shortInterestDirection === "positive"
                      ? "Short pressure easing"
                      : "Short pressure steady"
                  : shortInterestStatus === "loading"
                    ? "Checking"
                    : "No record found"}
              </strong>
              <p>
                {shortInterest
                  ? `${shortInterest.changePercent > 0 ? "+" : ""}${shortInterest.changePercent.toFixed(2)}% vs prior report · ${shortInterest.daysToCover.toFixed(2)} days to cover.`
                  : shortInterestCopy}
              </p>
            </div>
            {hasLeadershipChangeCluster ? (
              <div className="signal-tile offset">
                <span className="move-eyebrow">Management</span>
                <strong>Leadership changes active</strong>
                <p>
                  {corporateActivity?.copy}
                  {corporateActivity?.latestEventDate ? ` Latest filed ${formatDate(corporateActivity.latestEventDate)}.` : ""}
                </p>
              </div>
            ) : null}
            {hasCounterSignal ? (
              <div className="signal-tile offset">
                <span className="move-eyebrow">Signal offset</span>
                <strong>{hasInsiderOffset && hasPoliticalOffset ? "Selling present" : hasInsiderOffset ? "Insider selling present" : "Political sale present"}</strong>
                <p>
                  {insider.leadSale
                    ? `${insider.leadSale.metadata?.insiderName ?? "Insider"} sold ${insider.leadSale.metadata?.shares?.toLocaleString() ?? "shares"}${formatMoney(insider.leadSale.metadata?.totalValue) ? ` / ${formatMoney(insider.leadSale.metadata?.totalValue)}` : ""}.`
                    : politicalSale
                      ? `${politicalSale.filerName} reported a ${politicalSale.amountRange} sale, filed ${formatDate(politicalSale.filingDate)}.`
                    : `${insider.sales.length} open-market sale${insider.sales.length === 1 ? "" : "s"} in the last 90 days.`}
                </p>
              </div>
            ) : null}
          </div>

          {isFallback ? (
            <div className="move-fallback-grid">
              <div>
                <span className="move-eyebrow">Today</span>
                <strong>{ticker} {formatPercent(quote?.changePercent)}</strong>
                <p>
                  {hasRecentInsiderBuy
                    ? "No sourced same-day catalyst found. Recent insider buying is the strongest current signal."
                    : "No sourced same-day catalyst is loaded for this move."}
                </p>
              </div>
              <div>
                <span className="move-eyebrow">Peers</span>
                <strong>
                  {peerQuotes.length
                    ? peerQuotes.map((peerQuote) => `${peerQuote.ticker} ${formatPercent(peerQuote.changePercent)}`).join(" · ")
                    : "Peer quotes unavailable"}
                </strong>
                <p>Use this to separate company-specific moves from group pressure.</p>
              </div>
              <div>
                <span className="move-eyebrow">Latest known event</span>
                <strong>{latestKnownEvent?.title ?? "No recent sourced event"}</strong>
                <p>{latestKnownEvent ? latestKnownEvent.detail : "No headline or corporate disclosure is loaded yet."}</p>
              </div>
            </div>
          ) : (
            <>
              <p className="move-answer">{event.answer}</p>
              <span className="move-confidence move-confidence-inline">
                Catalyst: {confidenceLabel(event.confidence)}
              </span>
            </>
          )}

          {!isFallback && event.marketMove ? (
            <p className="move-market">{event.marketMove}</p>
          ) : null}

          {!isFallback && event.details.length > 0 ? (
          <ul className="move-details">
            {event.details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
          ) : null}

          <div className="disclosure-watch-card">
            <div>
              <span className="move-eyebrow">What to watch next</span>
              <strong>Corporate disclosures</strong>
              <p>{disclosureCopy}</p>
            </div>
            <span className="move-confidence move-confidence-inline">
              {latestDisclosure ? latestDisclosure.sourceLabel : disclosureStatus === "loading" ? "Checking" : "SEC"}
            </span>
          </div>

          {latestDisclosure ? (
            <div className={`disclosure-evidence-card ${latestDisclosure.direction}`}>
              <div>
                <span className="move-eyebrow">
                  {latestDisclosure.direction === "supporting" ? "Supporting evidence" : "Context evidence"} · {formatDate(latestDisclosure.filingDate)}
                </span>
                <strong>{latestDisclosure.title}</strong>
                <p>{latestDisclosure.summary} Reported {formatDate(latestDisclosure.filingDate)}.</p>
              </div>
              <div className="move-support-metrics">
                <span>{latestDisclosure.form}{latestDisclosure.item ? ` ${latestDisclosure.item}` : ""}</span>
                <a href={latestDisclosure.sourceUrl} rel="noreferrer" target="_blank">
                  {latestDisclosure.sourceLabel}
                </a>
              </div>
            </div>
          ) : null}

          <details className="move-hint">
            <summary>Conviction check</summary>
            <p>{event.convictionQuestion}</p>
          </details>

          <details className="move-hint ownership-details">
            <summary>Major ownership filings</summary>
            <p>{ownershipCopy}</p>
            <span className="move-confidence move-confidence-inline">
              {ownershipStatus === "loading" ? "Checking" : "13D / 13G"}
            </span>
            {ownershipFilings.length > 0 ? (
              <div className="evidence-line-list">
                {ownershipFilings.map((filing) => (
                  <a className="evidence-line" href={filing.sourceUrl} key={filing.id} rel="noreferrer" target="_blank">
                    <span>{filing.title}</span>
                    <strong>{filing.summary} Filed {formatDate(filing.filingDate)}.</strong>
                    <small>{filing.sourceLabel}</small>
                  </a>
                ))}
              </div>
            ) : null}
          </details>
        </div>
      ) : null}
    </section>
  );
}

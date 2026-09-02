"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { type PersistedPosition } from "@/lib/portfolio/persist";
import {
  computePortfolioMetrics,
  computePositionMetrics,
  computeSectorAllocation,
} from "@/lib/portfolio/calculations";
import {
  SAMPLE_PORTFOLIO_BOOKS,
  SAMPLE_BOOK_TARGET_VALUE,
  sizeSampleBookPositions,
  saveActiveSampleBookId,
  saveSampleBookPositions,
  getSampleBook,
  sampleBookLargestWeight,
  sampleBookSleeves,
  type SampleBook,
} from "@/lib/portfolio/sample-books";
import type { PortfolioPosition } from "@/lib/portfolio/types";
import type { StockQuote } from "@/lib/market/quotes";
import { getLivePrice } from "@/lib/market/live-quote";
import { fetchMarketQuotes } from "@/lib/market/client-market-data";
import { getSectorForCompany, normalizeSectorName } from "@/lib/market/industries";
import { getMarketInstrument } from "@/lib/market/market-instruments";
import { isFiniteNumber } from "@/lib/display/format";
import { notifyPortfolioChanged, usePortfolioData } from "@/components/PortfolioData";
import { PortfolioAllocationLadder } from "@/components/PortfolioAllocationLadder";
import { PortfolioHoldingCard } from "@/components/PortfolioHoldingCard";
import { ConcentrationNotice } from "@/components/ConcentrationNotice";
import SectorDonut from "@/components/SectorDonut";
import { PortfolioBenchmarkChart } from "@/components/PortfolioBenchmarkChart";
import { ProductStage } from "@/components/ProductStage";
import { SurfaceSlicer, type SurfaceSlicerOption } from "@/components/SurfaceSlicer";
import Watchlist from "@/components/Watchlist";
import { buildPortfolioValueBrief } from "@/lib/portfolio/value-brief";
import { getStudyBrief } from "@/lib/portfolio/study-briefs";
import { PROFILE_BENCHMARK } from "@/lib/portfolio/fit";
import type { BookHolding } from "@/lib/portfolio/sleeves";
import { generateSleeveMoves, visibleCompareMoves } from "@/lib/portfolio/sleeve-moves";
import {
  buildSparklineGeometry,
  sparklineStroke,
  sparklineToneFromChange,
  sparklineValuesFromQuote,
} from "@/lib/display/sparkline";

const PORTFOLIO_TEMPLATE_DEFAULT = "three-fund";

function studySignedPct(value: number): string {
  const rounded = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function signedCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value === 0) return "$0.00";
  return `${value > 0 ? "+" : "−"}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPortfolioDollars(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return "$" + Math.round(value).toLocaleString("en-US");
}

function percent(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

/** Brokerage-style day move: +$1,234.56 (+1.23%) */
function dayChangeParts(
  change: number | null,
  changePercent: number | null,
): { dollars: string; percent: string | null } | null {
  if (!isFiniteNumber(change)) return null;
  return {
    dollars: signedCurrency(change),
    percent: isFiniteNumber(changePercent) ? percent(changePercent) : null,
  };
}

function dayChangeTone(
  dailyChange: number | null,
): "positive" | "negative" | "neutral" {
  if (!isFiniteNumber(dailyChange) || dailyChange === 0) return "neutral";
  return dailyChange > 0 ? "positive" : "negative";
}

/** Soften hero chrome for small day moves; escalate past ~1% / ~2.5%. */
function dayMoveIntensity(
  changePercent: number | null,
): "mild" | "medium" | "strong" {
  if (!isFiniteNumber(changePercent)) return "mild";
  const abs = Math.abs(changePercent);
  if (abs < 1) return "mild";
  if (abs < 2.5) return "medium";
  return "strong";
}

function formatUpdatedAt(at: number | null): string | null {
  if (at == null) return null;
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(at));
}

/** Weighted book trail from holding sparklines (shares × close). */
function portfolioSparklineValues(
  positions: PersistedPosition[],
  quotes: StockQuote[],
): number[] {
  const quoteMap = new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote]));
  const series: number[][] = [];
  for (const position of positions) {
    const quote = quoteMap.get(position.ticker.toUpperCase());
    if (!quote || !(position.shares > 0)) continue;
    const closes = sparklineValuesFromQuote({
      sparkline: quote.sparkline,
      price: getLivePrice(quote).price ?? quote.price,
      previousClose: quote.previousClose,
      limit: 24,
    });
    if (closes.length < 2) continue;
    series.push(closes.map((close) => close * position.shares));
  }
  if (series.length === 0) return [];
  const length = Math.min(...series.map((row) => row.length));
  if (length < 2) return [];
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (const row of series) sum += row[row.length - length + i]!;
    out.push(sum);
  }
  return out;
}

function DaySpark({
  values,
  changePercent,
}: {
  values: number[];
  changePercent: number | null;
}) {
  const tone = sparklineToneFromChange(changePercent);
  const geometry = useMemo(
    () => (values.length >= 2 ? buildSparklineGeometry(values, 120, 40) : null),
    [values],
  );
  if (!geometry) return <span className="pf-day-spark is-empty" aria-hidden="true" />;

  return (
    <svg
      className="pf-day-spark"
      viewBox="0 0 120 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={geometry.path}
        fill="none"
        stroke={sparklineStroke(tone)}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

interface PortfolioProfile {
  sector: string | null;
  marketCap: number | null;
  longName: string | null;
  quoteType: string | null;
}

// ── Convert persisted positions to PortfolioPosition with live prices ───────

function resolveHoldingExposure(
  ticker: string,
  profile: PortfolioProfile | undefined,
): string | undefined {
  const instrument = getMarketInstrument(ticker);
  const quoteType = profile?.quoteType?.toUpperCase() ?? null;
  return instrument?.portfolioExposure
    ?? (quoteType === "ETF"
      ? "Other ETF"
      : quoteType === "MUTUALFUND"
        ? "Other Fund"
        : quoteType === "INDEX"
          ? "Index"
          : normalizeSectorName(profile?.sector)
            ?? normalizeSectorName(getSectorForCompany(ticker)?.name)
            ?? undefined);
}

function isFundQuoteType(ticker: string, profile: PortfolioProfile | undefined): boolean {
  const instrument = getMarketInstrument(ticker);
  const quoteType = profile?.quoteType?.toUpperCase() ?? null;
  return instrument?.kind === "etf"
    || quoteType === "ETF"
    || quoteType === "MUTUALFUND"
    || quoteType === "INDEX";
}

function enrichWithPrices(
  persisted: PersistedPosition[],
  quotes: StockQuote[],
): PortfolioPosition[] {
  const quoteMap = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q]));

  return persisted.map((p) => {
    const ticker = p.ticker.toUpperCase();
    const quote = quoteMap.get(ticker);
    const live = quote ? getLivePrice(quote) : null;
    return {
      companyId: ticker,
      ticker,
      shares: p.shares,
      averageCost: p.averageCost,
      // Mark to live session price so hero / day P&L track premarket & AH.
      currentPrice: live?.price ?? quote?.price ?? null,
      previousClose: quote?.previousClose ?? null,
      note: p.note,
    };
  });
}

// ── Main Component ──────────────────────────────────────────────────────────

type PortfolioView = "live" | "watchlist" | "study";

const PORTFOLIO_VIEWS: SurfaceSlicerOption[] = [
  { id: "live", label: "Live" },
  { id: "watchlist", label: "Watchlist" },
  { id: "study", label: "Study" },
];

function parsePortfolioView(searchParams: URLSearchParams): PortfolioView {
  if (searchParams.get("mode") === "study") return "study";
  const view = searchParams.get("view");
  if (view === "watchlist") return "watchlist";
  // Legacy Most held / Most watched boards are gone — land on Live.
  return "live";
}

export default function Portfolio() {
  const {
    quotes,
    data: sharedData,
    positions: personalPositions,
    refresh: refreshSharedQuotes,
  } = usePortfolioData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const view = parsePortfolioView(searchParams);
  const templateId = searchParams.get("template") || PORTFOLIO_TEMPLATE_DEFAULT;
  const [positions, setPositions] = useState<PersistedPosition[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const [sectorProfiles, setSectorProfiles] = useState<Record<string, PortfolioProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const sampleLoadRef = useRef(0);
  const sampleAbortRef = useRef<AbortController | null>(null);
  const sampleAwaitingQuotesRef = useRef(false);

  useEffect(() => {
    return () => {
      sampleAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (activeBookId === null) setPositions(personalPositions);
  }, [activeBookId, personalPositions]);

  useEffect(() => {
    if (!loadingBook || !sampleAwaitingQuotesRef.current || sharedData.loading) return;
    sampleAwaitingQuotesRef.current = false;
    setLoadingBook(false);
  }, [loadingBook, sharedData.loading, quotes, sharedData.error]);

  function clearActiveBook() {
    setActiveBookId(null);
    saveActiveSampleBookId(null);
  }

  // Share quotes from PortfolioDataProvider (one Yahoo fan-out for hero + holdings).
  useEffect(() => {
    if (sharedData.loading) {
      setLoading(true);
      return;
    }
    setLoading(false);
    if (quotes.length > 0) setLastUpdatedAt(Date.now());
    if (sharedData.error) setError(sharedData.error);
    else setError(null);
  }, [quotes, sharedData.loading, sharedData.error]);

  // Sector profiles only (quotes come from shared provider)
  const fetchSectorProfiles = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) {
      setSectorProfiles({});
      return;
    }
    try {
      const profileRes = await fetch(`/api/market/sector-profile?tickers=${tickers.join(",")}`);
      if (!profileRes.ok) return;
      const profileData = await profileRes.json();
      const profileMap: Record<string, PortfolioProfile> = {};
      for (const p of (profileData.profiles ?? [])) {
        profileMap[p.ticker] = {
          sector: p.sector,
          marketCap: p.marketCap,
          longName: p.longName,
          quoteType: p.quoteType,
        };
      }
      setSectorProfiles(profileMap);
    } catch {
      // Sector labels are optional enrichment.
    }
  }, []);

  // Fetch sector profiles whenever positions change
  useEffect(() => {
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    const unique = Array.from(new Set(tickers));
    void fetchSectorProfiles(unique);
  }, [positions, fetchSectorProfiles]);

  // ── Derived data ──

  const enriched = useMemo(() => enrichWithPrices(positions, quotes), [positions, quotes]);
  const portfolioMetrics = useMemo(() => computePortfolioMetrics(enriched), [enriched]);
  const sectorAllocation = useMemo(() => {
    const cmap = new Map<string, { id: string; ticker: string; name: string; assetType: "stock" | "etf" | "other"; sector?: string; industry?: string }>();
    for (const p of enriched) {
      const ticker = p.companyId.toUpperCase();
      if (cmap.has(ticker)) continue;
      const profile = sectorProfiles[ticker];
      const instrument = getMarketInstrument(ticker);
      const exposure = resolveHoldingExposure(ticker, profile);
      cmap.set(ticker, {
        id: ticker,
        ticker,
        name: profile?.longName ?? ticker,
        assetType: instrument?.kind === "crypto" ? "other" : isFundQuoteType(ticker, profile) ? "etf" : "stock",
        sector: exposure,
        industry: undefined,
      });
    }
    return computeSectorAllocation(enriched, cmap);
  }, [enriched, sectorProfiles]);
  const sectorMixData = useMemo(() => {
    if (sectorAllocation.unclassifiedWeight <= 0) {
      return sectorAllocation.sectors;
    }

    return [
      ...sectorAllocation.sectors,
      {
        sector: "Unclassified",
        weight: sectorAllocation.unclassifiedWeight,
        marketValue: sectorAllocation.unclassifiedMarketValue,
        positionCount: sectorAllocation.unclassifiedPositionCount,
      },
    ];
  }, [sectorAllocation]);
  const hasData = enriched.length > 0;

  // ── Sorted positions (value desc — feeds Fit / Sector Mix / sleeve moves) ──

  const sortedPositions = useMemo(() => {
    const rows = enriched.map((pos) => {
      const metrics = computePositionMetrics(pos, portfolioMetrics.totalMarketValue, portfolioMetrics.dailyChange);
      const dailyPct = pos.currentPrice != null && pos.previousClose != null
        ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
        : null;
      return { pos, metrics, dailyPct };
    });

    rows.sort((a, b) => (b.metrics.marketValue ?? 0) - (a.metrics.marketValue ?? 0));
    return rows;
  }, [enriched, portfolioMetrics]);

  const portfolioHeatmapSession = useMemo(() => {
    for (const quote of quotes) {
      const label = getLivePrice(quote).label;
      if (label) return label;
    }
    return null;
  }, [quotes]);

  const bookHoldings = useMemo<BookHolding[]>(
    () => sortedPositions.map(({ pos, metrics }) => {
      const ticker = pos.companyId.toUpperCase();
      return {
        ticker,
        weight: metrics.weight,
        exposure: resolveHoldingExposure(ticker, sectorProfiles[ticker]) ?? null,
      };
    }),
    [sectorProfiles, sortedPositions],
  );

  const valueBrief = useMemo(
    () => buildPortfolioValueBrief(bookHoldings),
    [bookHoldings],
  );

  const dayTone = dayChangeTone(portfolioMetrics.dailyChange);
  const dayIntensity = dayMoveIntensity(portfolioMetrics.dailyChangePercent);
  const dayMove = dayChangeParts(
    portfolioMetrics.dailyChange,
    portfolioMetrics.dailyChangePercent,
  );
  const stageTone =
    dayTone === "positive"
      ? "positive"
      : dayTone === "negative"
        ? "negative"
        : valueBrief.tone === "concentrated"
          ? "concentrated"
          : valueBrief.tone === "watch"
            ? "watch"
            : "balanced";
  const stageIntensity =
    stageTone === "positive" || stageTone === "negative"
      ? dayIntensity
      : "strong";
  const daySparkValues = useMemo(
    () => portfolioSparklineValues(positions, quotes),
    [positions, quotes],
  );
  const updatedLabel = formatUpdatedAt(lastUpdatedAt);

  const allocationItems = useMemo(() => sortedPositions
    .filter(({ metrics }) => metrics.weight !== null)
    .map(({ pos, metrics }) => {
      const ticker = pos.companyId.toUpperCase();
      const quote = quotes.find((item) => item.ticker.toUpperCase() === ticker);
      return {
        ticker,
        companyName: quote?.name ?? ticker,
        weight: metrics.weight ?? 0,
        sector: resolveHoldingExposure(ticker, sectorProfiles[ticker]),
        marketValue: formatPortfolioDollars(metrics.marketValue),
        dailyChange: signedCurrency(metrics.dailyChange),
        dailyChangeValue: metrics.dailyChange,
      };
    })
    .sort((a, b) => b.weight - a.weight), [quotes, sectorProfiles, sortedPositions]);

  // ── Data-quality states ──

  const quoteFetchFailed = !loading && error !== null;
  const calcFailed = portfolioMetrics.totalMarketValue === null && hasData && !loading && !quoteFetchFailed;

  // ── Handlers ──

  function handleRefresh() {
    refreshSharedQuotes();
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    void fetchSectorProfiles(Array.from(new Set(tickers)));
    setLastUpdatedAt(Date.now());
  }

  async function handleLoadSample(book: SampleBook) {
    sampleAbortRef.current?.abort();
    const controller = new AbortController();
    sampleAbortRef.current = controller;
    const requestId = sampleLoadRef.current + 1;
    sampleLoadRef.current = requestId;
    sampleAwaitingQuotesRef.current = false;
    setLoadingBook(true);
    setError(null);
    setActiveBookId(book.id);
    saveActiveSampleBookId(book.id);

    const priceMap: Record<string, number | null> = {};
    try {
      const quotes = await fetchMarketQuotes(book.tickers, {
        reason: "manual",
        signal: controller.signal,
      });
      for (const quote of quotes) {
        const live = getLivePrice(quote);
        priceMap[quote.ticker.toUpperCase()] = live.price ?? quote.price ?? null;
      }
    } catch {
      if (controller.signal.aborted) return;
      // Fall through to placeholder sizing; quotes provider will catch up.
    }

    if (requestId !== sampleLoadRef.current) return;
    const sized = sizeSampleBookPositions(book, priceMap, SAMPLE_BOOK_TARGET_VALUE);
    saveSampleBookPositions(book.id, sized);
    setPositions(sized);
    sampleAwaitingQuotesRef.current = true;
    notifyPortfolioChanged();
  }

  function handleSelectPersonal() {
    sampleAbortRef.current?.abort();
    sampleLoadRef.current += 1;
    sampleAwaitingQuotesRef.current = false;
    setLoadingBook(false);
    clearActiveBook();
    setPositions(personalPositions);
    notifyPortfolioChanged();
  }

  const allocationPanel = !calcFailed ? (
    <PortfolioAllocationLadder
      items={allocationItems}
      eyebrow="Concentration"
      title="Largest positions"
      hint="Bar color matches industry (Sector Mix). Markers at 12% watch and 20% concentrated."
    />
  ) : null;

  const concentrationNotice = !calcFailed && allocationItems.length > 0 ? (
    <ConcentrationNotice
      holdings={allocationItems.map((item) => ({
        ticker: item.ticker,
        name: item.companyName,
        weight: item.weight,
      }))}
    />
  ) : null;

  // ── Render ──

  const fitDiagnosis = valueBrief.headline;
  const stageEyebrow = `Portfolio · Live data · ${portfolioHeatmapSession ?? "Market session"}`;
  const profile = valueBrief.fit.defaultProfile ?? "growth-income";
  const benchmark = PROFILE_BENCHMARK[profile];

  const studyBook =
    getSampleBook(templateId)
    ?? getSampleBook(PORTFOLIO_TEMPLATE_DEFAULT)
    ?? SAMPLE_PORTFOLIO_BOOKS[0];
  const studyBrief = getStudyBrief(studyBook);
  const studySleeves = (studyBrief?.sleeves ?? sampleBookSleeves(studyBook).map((sleeve) => ({
    ...sleeve,
    role: "",
  })))
    .slice()
    .sort((a, b) => b.weight - a.weight);
  // Concentration + quiet moves vs the user's real book — only when they have one.
  // Prefer personalPositions so a sample-load path cannot pollute “your book.”
  const hasLiveBook = personalPositions.length > 0 && activeBookId === null;
  const studyDelta = hasLiveBook && valueBrief.largest
    ? Math.round(valueBrief.largest.weight - sampleBookLargestWeight(studyBook))
    : null;
  const studyMoves = hasLiveBook
    ? visibleCompareMoves(generateSleeveMoves(bookHoldings, studyBook))
    : [];

  function goLive() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    params.delete("template");
    params.delete("view");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  function goWatchlist() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    params.delete("template");
    params.set("view", "watchlist");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }
  function goStudy(template?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.set("mode", "study");
    params.set("template", template ?? templateId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function selectView(next: PortfolioView) {
    if (next === "live") goLive();
    else if (next === "watchlist") goWatchlist();
    else goStudy();
  }

  const sectorMixCard = hasData && !calcFailed && sectorMixData.length > 0 ? (
    <section className="pf-section pf-sector-mix surface-shell" aria-label="Sector mix">
      <header className="pf-sector-mix-head">
        <span className="pf-section-eyebrow">Sector Mix</span>
      </header>
      <div className="pf-sector-mix-donut surface-well">
        <SectorDonut sectors={sectorMixData} />
      </div>
    </section>
  ) : null;

  const studyRegion = (
    <div className="pf-study">
      <div className="pf-study-chips" role="tablist" aria-label="Study templates">
        {SAMPLE_PORTFOLIO_BOOKS.map((book) => (
          <button
            key={book.id}
            type="button"
            role="tab"
            aria-selected={book.id === studyBook.id}
            title={book.description}
            className={`pf-study-chip${book.id === studyBook.id ? " is-active" : ""}`}
            onClick={() => goStudy(book.id)}
          >
            <span className="pf-study-chip-emoji" aria-hidden="true">{book.emoji}</span>
            <span>{book.label}</span>
          </button>
        ))}
      </div>

      <section className="pf-study-board surface-shell" aria-labelledby="pf-study-title">
        <header className="pf-study-board-head">
          <span className="pf-study-badge">Sample</span>
          <h2 id="pf-study-title">
            <span className="pf-study-title-emoji" aria-hidden="true">{studyBook.emoji}</span>
            {studyBook.label}
          </h2>
          <p className="pf-study-lede">{studyBrief?.principle ?? studyBook.description}</p>
        </header>
        {studyBrief ? (
          <div className="pf-study-machine surface-well">
            <div>
              <span>How it’s built</span>
              <p>{studyBrief.design}</p>
            </div>
            <div>
              <span>What breaks it</span>
              <p>{studyBrief.stress}</p>
            </div>
          </div>
        ) : null}
      </section>

      {studyBrief ? (
        <section
          className="pf-study-board surface-shell"
          aria-label={`${studyBook.label} illustrative history`}
        >
          <header className="pf-study-board-head">
            <span className="pf-section-eyebrow">Historical performance</span>
            <h2>{studyBrief.performance.periodLabel}</h2>
          </header>
          <div className="pf-study-history surface-well">
            <div className="pf-study-history-metrics">
              <div className="is-avg">
                <span>Annualized</span>
                <strong>{studySignedPct(studyBrief.performance.annualizedPct)}</strong>
              </div>
              <div className="is-best">
                <span>Best · {studyBrief.performance.bestYear.year}</span>
                <strong>{studySignedPct(studyBrief.performance.bestYear.pct)}</strong>
              </div>
              <div className="is-worst">
                <span>Worst · {studyBrief.performance.worstYear.year}</span>
                <strong>{studySignedPct(studyBrief.performance.worstYear.pct)}</strong>
              </div>
            </div>
            <p className="pf-study-history-note">
              Study figures for learning the design — not a live track record of this book.
            </p>
          </div>
        </section>
      ) : null}

      <div className="pf-study-ladder">
        <PortfolioAllocationLadder
          items={studySleeves.map((sleeve) => ({
            ticker: sleeve.ticker,
            companyName: sleeve.role || sleeve.ticker,
            weight: sleeve.weight,
            sector: getMarketInstrument(sleeve.ticker)?.portfolioExposure ?? null,
          }))}
          eyebrow="Target mix"
          hint="Bar color matches sleeve exposure. Markers at 12% watch and 20% concentrated."
        />
      </div>

      {studyDelta !== null || studyMoves.length > 0 ? (
        <section className="pf-study-board surface-shell" aria-label="Your book vs this template">
          <header className="pf-study-board-head">
            <span className="pf-section-eyebrow">Vs your book</span>
            <h2>
              {studyDelta === null
                ? `Toward ${studyBook.label}`
                : Math.abs(studyDelta) < 1
                  ? "About the same concentration"
                  : `${studyDelta > 0 ? "+" : "−"}${Math.abs(studyDelta)}pt ${studyDelta > 0 ? "more" : "less"} concentrated`}
            </h2>
          </header>
          {studyMoves.length > 0 ? (
            <div className="pf-study-moves surface-well">
              <span>Moves vs your book</span>
              <ul>
                {studyMoves.map((move) => (
                  <li key={`${move.action}-${move.ticker}-${move.label}`}>
                    <strong>{move.label}</strong>
                    <em>{move.why}</em>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );

  return (
    <div className="pf">
      <SurfaceSlicer
        label="Portfolio view"
        options={PORTFOLIO_VIEWS}
        activeId={view}
        onChange={(id) => selectView(id as PortfolioView)}
        className="pf-view-slicer"
      />

      {view === "watchlist" ? (
        <div className="pf-watchlist">
          <Watchlist />
        </div>
      ) : view === "study" ? (
        studyRegion
      ) : (
      <>
      {hasData ? (
        <>
        <ProductStage
          variant="portfolio"
          aria-label="Portfolio overview"
          loading={loading}
          tone={stageTone}
          intensity={stageIntensity}
          eyebrow={stageEyebrow}
          typewriterHeadline={false}
          metricsPlacement="above"
          metrics={
            <>
              <div className="is-lead">
                <strong className="tnum">{formatPortfolioDollars(portfolioMetrics.totalMarketValue)}</strong>
                <span>Portfolio Value</span>
                <p className="pf-hero-diagnosis">{fitDiagnosis}</p>
              </div>
              <div className={`pf-day-strip is-${dayTone}`}>
                <div className="pf-day-strip-copy">
                  <div className="pf-day-strip-figures tnum">
                    {dayMove ? (
                      <strong aria-label={dayMove.percent ? `${dayMove.dollars} (${dayMove.percent})` : dayMove.dollars}>
                        {dayMove.dollars}
                        {dayMove.percent ? (
                          <span className="pf-day-strip-pct">({dayMove.percent})</span>
                        ) : null}
                      </strong>
                    ) : (
                      <strong>—</strong>
                    )}
                  </div>
                  <span>Today</span>
                </div>
                <DaySpark
                  values={daySparkValues}
                  changePercent={portfolioMetrics.dailyChangePercent}
                />
              </div>
            </>
          }
        />
        <div className="pf-live-meta">
          <button
            type="button"
            className="pf-live-meta-refresh"
            onClick={handleRefresh}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh prices"}
          </button>
          {updatedLabel ? (
            <span className="pf-live-meta-updated">Last updated {updatedLabel}</span>
          ) : null}
        </div>
        {concentrationNotice}
        {sectorMixCard}
        {allocationPanel}
        <PortfolioBenchmarkChart
          positions={positions.map((position) => ({ ticker: position.ticker, shares: position.shares }))}
          benchmarkTicker={benchmark.ticker}
          benchmarkLabel={benchmark.label}
          skipChart={calcFailed}
        />
        </>
      ) : (
        <div className="pf-empty-prompt">
          <p>No positions yet — build your portfolio or explore a template.</p>
          <Link href="/manage?view=portfolio" className="brief-link">
            Add portfolio holdings <span aria-hidden="true">→</span>
          </Link>
          <button type="button" className="brief-link" onClick={() => goStudy()}>
            Explore a template <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {hasData ? (
        <section id="portfolio-panel-holdings" className="pf-holdings" aria-label="Portfolio holdings">
          <header className="pf-holdings-head">
            <div className="pf-holdings-copy">
              <span className="pf-section-eyebrow">Holdings</span>
              <h2>
                {sortedPositions.length} holding{sortedPositions.length === 1 ? "" : "s"}
              </h2>
            </div>
            <Link href="/manage?view=portfolio" className="data-edit-pill">
              Manage holdings
            </Link>
          </header>
          <div className="pf-holdings-list surface-well">
            {sortedPositions.map(({ pos, metrics }) => {
              const tickerKey = pos.companyId.toUpperCase();
              const quote = quotes.find((item) => item.ticker.toUpperCase() === tickerKey);
              const live = quote ? getLivePrice(quote) : null;
              return (
                <PortfolioHoldingCard
                  key={tickerKey}
                  ticker={tickerKey}
                  companyName={quote?.name ?? tickerKey}
                  price={live?.price ?? quote?.price ?? pos.currentPrice ?? null}
                  changePercent={live?.changePercent ?? quote?.changePercent ?? null}
                  sessionLabel={live?.label ?? null}
                  closePrice={live?.label ? quote?.price ?? null : null}
                  closeChangePercent={live?.label ? quote?.changePercent ?? null : null}
                  shares={pos.shares}
                  metrics={metrics}
                />
              );
            })}
          </div>
        </section>
      ) : null}
      </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { loadPositions, savePositions, type PersistedPosition } from "@/lib/portfolio/persist";
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
import { getSectorForCompany, normalizeSectorName } from "@/lib/market/industries";
import { getMarketInstrument } from "@/lib/market/market-instruments";
import { isFiniteNumber } from "@/lib/display/format";
import type { CompanySuggestion } from "@/lib/sec/company-tickers";
import { PageLoadingMotion } from "@/components/PageLoadingMotion";
import { PortfolioHoldingCard } from "@/components/PortfolioHoldingCard";
import { notifyPortfolioChanged, usePortfolioData } from "@/components/PortfolioData";
import { PortfolioAllocationLadder } from "@/components/PortfolioAllocationLadder";
import SectorDonut from "@/components/SectorDonut";
import { PortfolioBenchmarkChart } from "@/components/PortfolioBenchmarkChart";
import { ProductStage } from "@/components/ProductStage";
import { buildPortfolioValueBrief } from "@/lib/portfolio/value-brief";
import Link from "next/link";

const PORTFOLIO_TEMPLATE_DEFAULT = "three-fund";

function sleeveWeightLabel(value: number): string {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function currency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function signedCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (value === 0) return "$0.00";
  return `${value > 0 ? "+" : "−"}$${Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function compactCurrency(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  if (Math.abs(value) >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "M";
  }
  if (Math.abs(value) >= 1_000) {
    return "$" + (value / 1_000).toFixed(1) + "K";
  }
  return "$" + value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percent(value: number | null): string {
  if (!isFiniteNumber(value)) return "—";
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

// ── Sort types ──────────────────────────────────────────────────────────────

type SortKey = "ticker" | "value" | "weight" | "dayGl" | "totalGl";
type SortDir = "asc" | "desc";

interface SortState {
  key: SortKey;
  dir: SortDir;
}

interface PortfolioProfile {
  sector: string | null;
  marketCap: number | null;
  longName: string | null;
  quoteType: string | null;
}

// ── Convert persisted positions to PortfolioPosition with live prices ───────

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

function SampleBooksSwitcher({
  activeId,
  onSelect,
  onSelectPersonal,
  disabled = false,
}: {
  activeId: string | null;
  onSelect: (book: SampleBook) => void;
  onSelectPersonal: () => void;
  disabled?: boolean;
}) {
  const personalActive = activeId === null;

  return (
    <section className="pf-book-switch" aria-label="Portfolio books">
      <div className="pf-book-switch-primary">
        <button
          type="button"
          role="tab"
          aria-selected={personalActive}
          disabled={disabled}
          className={`pf-book-switch-mine${personalActive ? " is-active" : ""}`}
          onClick={onSelectPersonal}
        >
          <span className="pf-book-switch-mine-label">My Portfolio</span>
          <svg
            className="pf-book-switch-pencil"
            viewBox="0 0 120 6"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M1.5 3.2 C 18 1.1, 34 4.8, 52 2.6 S 88 5.2, 118.5 2.9"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="pf-book-switch-samples" role="group" aria-label="Sample portfolio options">
        <p className="pf-book-switch-samples-label">Or try a sample portfolio</p>
        <div className="pf-book-switch-tabs" role="tablist" aria-label="Sample portfolio books">
          {SAMPLE_PORTFOLIO_BOOKS.map((book) => {
            const selected = activeId === book.id;
            return (
              <button
                key={book.id}
                type="button"
                role="tab"
                aria-selected={selected}
                title={book.description}
                disabled={disabled}
                className={`pf-book-switch-tab${selected ? " is-active" : ""}`}
                onClick={() => onSelect(book)}
              >
                {book.label}
              </button>
            );
          })}
        </div>
      </div>

    </section>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function Portfolio({
  composeFirst = false,
}: {
  /** Render Add position above holdings (My List). */
  composeFirst?: boolean;
}) {
  const { quotes, data: sharedData, refresh: refreshSharedQuotes } = usePortfolioData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const mode: "live" | "study" = searchParams.get("mode") === "study" ? "study" : "live";
  const templateId = searchParams.get("template") || PORTFOLIO_TEMPLATE_DEFAULT;
  const [positions, setPositions] = useState<PersistedPosition[]>([]);
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [loadingBook, setLoadingBook] = useState(false);
  const [sectorProfiles, setSectorProfiles] = useState<Record<string, PortfolioProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [sort, setSort] = useState<SortState>({ key: "value", dir: "desc" });
  // Track whether data has ever loaded successfully (for data-quality states)
  const [quotesEverLoaded, setQuotesEverLoaded] = useState(false);

  // ── Add form state ──
  const [formTicker, setFormTicker] = useState("");
  const [formShares, setFormShares] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTicker, setEditingTicker] = useState<string | null>(null);
  const [removingTicker, setRemovingTicker] = useState<string | null>(null);
  const sampleLoadRef = useRef(0);
  const sampleAbortRef = useRef<AbortController | null>(null);
  const sampleAwaitingQuotesRef = useRef(false);

  // Load personal positions on mount. Study Mode reads templates from the URL,
  // so we no longer resolve a stored sample book into the live positions.
  useEffect(() => {
    setPositions(loadPositions());
    return () => {
      sampleAbortRef.current?.abort();
    };
  }, []);

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
    if (quotes.length > 0) setQuotesEverLoaded(true);
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
      const quoteType = profile?.quoteType?.toUpperCase() ?? null;
      const isFund = instrument?.kind === "etf"
        || quoteType === "ETF"
        || quoteType === "MUTUALFUND"
        || quoteType === "INDEX";
      const exposure = instrument?.portfolioExposure
        ?? (quoteType === "ETF"
          ? "Other ETF"
          : quoteType === "MUTUALFUND"
            ? "Other Fund"
            : quoteType === "INDEX"
              ? "Index"
              : normalizeSectorName(profile?.sector)
                ?? normalizeSectorName(getSectorForCompany(ticker)?.name)
                ?? undefined);
      cmap.set(ticker, {
        id: ticker,
        ticker,
        name: profile?.longName ?? ticker,
        assetType: instrument?.kind === "crypto" ? "other" : isFund ? "etf" : "stock",
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

  // ── Sorted positions ──

  const sortedPositions = useMemo(() => {
    const rows = enriched.map((pos) => {
      const metrics = computePositionMetrics(pos, portfolioMetrics.totalMarketValue, portfolioMetrics.dailyChange);
      const dailyPct = pos.currentPrice != null && pos.previousClose != null
        ? ((pos.currentPrice - pos.previousClose) / pos.previousClose) * 100
        : null;
      return { pos, metrics, dailyPct };
    });

    rows.sort((a, b) => {
      let cmp = 0;
      const dir = sort.dir === "desc" ? -1 : 1;
      switch (sort.key) {
        case "ticker":
          cmp = a.pos.companyId.localeCompare(b.pos.companyId);
          break;
        case "value":
          cmp = (a.metrics.marketValue ?? 0) - (b.metrics.marketValue ?? 0);
          break;
        case "weight":
          cmp = (a.metrics.weight ?? 0) - (b.metrics.weight ?? 0);
          break;
        case "dayGl":
          cmp = (a.metrics.dailyChange ?? 0) - (b.metrics.dailyChange ?? 0);
          break;
        case "totalGl":
          cmp = (a.metrics.totalGainLoss ?? 0) - (b.metrics.totalGainLoss ?? 0);
          break;
      }
      return cmp * dir;
    });

    return rows;
  }, [enriched, portfolioMetrics, sort]);

  const portfolioHeatmapSession = useMemo(() => {
    for (const quote of quotes) {
      const label = getLivePrice(quote).label;
      if (label) return label;
    }
    return null;
  }, [quotes]);

  const valueBrief = useMemo(
    () => buildPortfolioValueBrief(sortedPositions.map(({ pos, metrics }) => ({
      ticker: pos.companyId.toUpperCase(),
      weight: metrics.weight,
    }))),
    [sortedPositions],
  );

  const stageTone = valueBrief.tone;

  const allocationItems = useMemo(() => sortedPositions
    .filter(({ metrics }) => metrics.weight !== null)
    .map(({ pos, metrics }) => {
      const ticker = pos.companyId.toUpperCase();
      const quote = quotes.find((item) => item.ticker.toUpperCase() === ticker);
      return {
        ticker,
        companyName: quote?.name ?? ticker,
        weight: metrics.weight ?? 0,
        marketValue: compactCurrency(metrics.marketValue),
        dailyChange: signedCurrency(metrics.dailyChange),
        dailyChangeValue: metrics.dailyChange,
      };
    })
    .sort((a, b) => b.weight - a.weight), [quotes, sortedPositions]);

  // ── Data-quality states ──

  const hasQuotes = quotes.length > 0;
  const quoteFetchFailed = !loading && error !== null;
  const partialQuotes = hasQuotes && portfolioMetrics.positionsMissingPrice > 0;
  const missingCost = portfolioMetrics.positionsMissingCost > 0;
  const calcFailed = portfolioMetrics.totalMarketValue === null && hasData && !loading && !quoteFetchFailed;

  // ── Handlers ──

  function savePositionFromForm() {
    setFormError(null);

    const ticker = (editingTicker ?? formTicker).trim().toUpperCase();
    if (!ticker) {
      setFormError("Enter a valid ticker symbol");
      return false;
    }
    // New adds stay simple tickers; edits keep whatever is already in the book (e.g. BTC-USD).
    if (!editingTicker && !/^[A-Z]{1,5}$/.test(ticker)) {
      setFormError("Enter a valid ticker symbol (1–5 letters)");
      return false;
    }

    const shares = parseFloat(formShares);
    if (isNaN(shares) || shares <= 0) {
      setFormError("Enter a valid number of shares");
      return false;
    }

    const cost = formCost.trim() ? parseFloat(formCost) : undefined;
    if (cost !== undefined && (isNaN(cost) || cost <= 0)) {
      setFormError("Enter a valid average cost");
      return false;
    }

    const updated = [...positions];
    const existingIndex = updated.findIndex((position) => position.ticker.toUpperCase() === ticker);
    const nextPosition = { ticker, shares, averageCost: cost };
    if (existingIndex >= 0) updated[existingIndex] = nextPosition;
    else updated.push(nextPosition);
    savePositions(updated);
    setPositions(updated);
    clearActiveBook();
    notifyPortfolioChanged();
    setFormTicker("");
    setFormShares("");
    setFormCost("");
    setEditingTicker(null);
    setRemovingTicker(null);
    setShowAddForm(false);
    return true;
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    savePositionFromForm();
  }

  function handleRemove(ticker: string) {
    const updated = positions.filter((position) => position.ticker.toUpperCase() !== ticker.toUpperCase());
    savePositions(updated);
    setPositions(updated);
    clearActiveBook();
    setRemovingTicker(null);
    if (editingTicker?.toUpperCase() === ticker.toUpperCase()) {
      setEditingTicker(null);
      setFormTicker("");
      setFormShares("");
      setFormCost("");
      setFormError(null);
    }
    notifyPortfolioChanged();
  }

  function handleRefresh() {
    refreshSharedQuotes();
    const tickers = positions.map((p) => p.ticker).filter(Boolean);
    void fetchSectorProfiles(Array.from(new Set(tickers)));
  }

  function handleClearAll() {
    savePositions([]);
    setPositions([]);
    clearActiveBook();
    notifyPortfolioChanged();
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
    setShowAddForm(false);
    setEditingTicker(null);
    setFormError(null);
    setActiveBookId(book.id);
    saveActiveSampleBookId(book.id);

    const priceMap: Record<string, number | null> = {};
    try {
      const res = await fetch(`/api/market/quotes?tickers=${book.tickers.join(",")}`, {
        signal: controller.signal,
      });
      if (res.ok) {
        const data = (await res.json()) as { quotes?: StockQuote[] };
        for (const quote of data.quotes ?? []) {
          const live = getLivePrice(quote);
          priceMap[quote.ticker.toUpperCase()] = live.price ?? quote.price ?? null;
        }
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
    setPositions(loadPositions());
    notifyPortfolioChanged();
  }

  function handleStartEdit(ticker: string) {
    const pos = positions.find((p) => p.ticker.toUpperCase() === ticker.toUpperCase());
    if (!pos) return;
    setFormTicker(pos.ticker);
    setFormShares(String(pos.shares));
    setFormCost(pos.averageCost != null ? String(pos.averageCost) : "");
    setEditingTicker(ticker);
    setRemovingTicker(null);
    setFormError(null);
    // Keep Add compose closed — edit happens inline on the holding card.
    setShowAddForm(false);
  }

  function handleCancelEdit() {
    setEditingTicker(null);
    setFormTicker("");
    setFormShares("");
    setFormCost("");
    setFormError(null);
    setShowAddForm(false);
  }

  function toggleSort(key: SortKey) {
    setSort((prev) => ({
      key,
      dir: prev.key === key && prev.dir === "desc" ? "asc" : "desc",
    }));
  }

  function sortArrow(key: SortKey): string {
    if (sort.key !== key) return "";
    return sort.dir === "desc" ? " ↓" : " ↑";
  }

  // Keep Add collapsed when empty so sample books stay above the fold.
  // Open only when editing an existing position.
  // Edit is inline on the holding card; compose is only for adding.
  const composeExpanded = !editingTicker && showAddForm;

  function toggleCompose() {
    if (editingTicker) handleCancelEdit();
    setShowAddForm((open) => !open);
  }

  const composeBar = (
    <section
      className={`list-compose ink-panel ${composeExpanded ? "is-open" : "is-collapsed"}`}
      aria-label="Add a position"
    >
      <button
        type="button"
        className="list-compose-toggle"
        aria-expanded={composeExpanded}
        aria-controls="portfolio-add-form"
        onClick={toggleCompose}
      >
        <div className="list-compose-copy">
          <strong className="list-compose-title">Add a position</strong>
        </div>
        <span className="list-compose-chevron" aria-hidden="true" />
      </button>
      {composeExpanded ? (
        <>
          <div id="portfolio-add-form" className="pf-add-form-wrap list-compose-fields">
            <AddForm
              editingTicker={null}
              formTicker={formTicker}
              formShares={formShares}
              formCost={formCost}
              formError={formError}
              onTickerChange={setFormTicker}
              onSharesChange={setFormShares}
              onCostChange={setFormCost}
              onSubmit={handleAdd}
              onCancel={() => {
                setShowAddForm(false);
                setFormTicker("");
                setFormShares("");
                setFormCost("");
                setFormError(null);
              }}
            />
          </div>
        </>
      ) : null}
    </section>
  );

  const allocationPanel = !calcFailed ? (
    <div className="pf-insights-allocation">
      <PortfolioAllocationLadder items={allocationItems} />
    </div>
  ) : null;

  // ── Render ──

  const stageHeadline = valueBrief.headline;
  const stageSummary = valueBrief.summary;
  const stageEyebrow = `Portfolio · Live data · ${portfolioHeatmapSession ?? "Market session"}`;

  const studyBook =
    getSampleBook(templateId)
    ?? getSampleBook(PORTFOLIO_TEMPLATE_DEFAULT)
    ?? SAMPLE_PORTFOLIO_BOOKS[0];
  const studySleeves = sampleBookSleeves(studyBook)
    .slice()
    .sort((a, b) => b.weight - a.weight);
  // Concentration comparison vs the user's real book — only when they have one.
  const studyDelta = positions.length > 0 && valueBrief.largest
    ? Math.round(valueBrief.largest.weight - sampleBookLargestWeight(studyBook))
    : null;

  function goLive() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("mode");
    params.delete("template");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }
  function goStudy(template?: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("mode", "study");
    params.set("template", template ?? templateId);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  const capitalMapCard = hasData && !calcFailed ? (
    <section className="pf-section pf-capital-map" aria-label="Capital map">
      <header className="pf-capital-map-head">
        <span className="pf-section-eyebrow">Capital Map</span>
        <h2>Asset-class mix, drilling into positions</h2>
      </header>
      {sectorMixData.length > 0 ? (
        <div className="pf-capital-map-donut">
          <SectorDonut sectors={sectorMixData} />
        </div>
      ) : null}
      <div className="pf-capital-map-divider" aria-hidden="true" />
      {allocationPanel}
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
            {book.label}
          </button>
        ))}
      </div>
      <section className="pf-study-book" aria-labelledby="pf-study-title">
        <span className="pf-study-badge">Sample</span>
        <h2 id="pf-study-title">{studyBook.label}</h2>
        <p className="pf-study-lede">{studyBook.description}</p>
        <ol className="pf-study-sleeves">
          {studySleeves.map((sleeve) => (
            <li key={sleeve.ticker}>
              <Link href={`/companies/${sleeve.ticker}`}>{sleeve.ticker}</Link>
              <b>{sleeveWeightLabel(sleeve.weight)}</b>
            </li>
          ))}
        </ol>
        {studyDelta !== null ? (
          <div className="pf-study-compare">
            <span>Your book vs this template</span>
            <strong className={studyDelta > 0 ? "is-alert" : studyDelta < 0 ? "is-positive" : ""}>
              {Math.abs(studyDelta) < 1
                ? "About the same concentration"
                : `${studyDelta > 0 ? "+" : "−"}${Math.abs(studyDelta)}pt ${studyDelta > 0 ? "more" : "less"} concentrated`}
            </strong>
          </div>
        ) : null}
      </section>
    </div>
  );

  return (
    <div className="pf">
      <div className="pf-mode-switch" role="tablist" aria-label="Portfolio mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "live"}
          className={`pf-mode-tab${mode === "live" ? " is-active" : ""}`}
          onClick={goLive}
        >
          <span className="pf-mode-dot" aria-hidden="true" />
          Live Portfolio
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "study"}
          className={`pf-mode-tab${mode === "study" ? " is-active" : ""}`}
          onClick={() => goStudy()}
        >
          Study Mode
        </button>
      </div>

      {mode === "study" ? studyRegion : (
      <>
      {hasData ? (
        <ProductStage
          variant="portfolio"
          aria-label="Portfolio overview"
          loading={loading}
          tone={stageTone}
          eyebrow={stageEyebrow}
          headline={stageHeadline}
          summary={stageSummary}
          metrics={
            <>
              <div>
                <strong className="tnum">{currency(portfolioMetrics.totalMarketValue)}</strong>
                <span>Total value</span>
              </div>
              <div
                className={
                  portfolioMetrics.dailyChange !== null && portfolioMetrics.dailyChange < 0
                    ? "is-negative"
                    : portfolioMetrics.dailyChange !== null && portfolioMetrics.dailyChange > 0
                      ? "is-positive"
                      : ""
                }
              >
                <strong className="tnum">{signedCurrency(portfolioMetrics.dailyChange)}</strong>
                <span>Today · {percent(portfolioMetrics.dailyChangePercent)}</span>
              </div>
              <div className={valueBrief.largest && valueBrief.largest.weight > 20 ? "is-alert" : ""}>
                <strong className="tnum">
                  {valueBrief.largest
                    ? `${valueBrief.largest.ticker} ${valueBrief.largest.weight.toFixed(0)}%`
                    : "—"}
                </strong>
                <span>Largest position</span>
              </div>
            </>
          }
        >
          <div className="product-stage-actions">
            <button type="button" className="product-stage-action" onClick={handleRefresh} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh prices"}
            </button>
          </div>
        </ProductStage>
      ) : (
        <div className="pf-empty-prompt">
          <p>No positions yet — add holdings or explore a template.</p>
          {composeBar}
          <button type="button" className="brief-link" onClick={() => goStudy()}>
            Explore a template <span aria-hidden="true">→</span>
          </button>
        </div>
      )}

      {hasData && !calcFailed ? (
        <PortfolioBenchmarkChart
          positions={positions.map((position) => ({ ticker: position.ticker, shares: position.shares }))}
        />
      ) : null}

      {capitalMapCard}

      {hasData ? (
      <div id="portfolio-panel-holdings" className="pf-value-view" aria-label="Portfolio holdings">
        {loading ? (
          <PageLoadingMotion
            label="Loading portfolio prices"
            compact
            showLabel={false}
            showSubtitle={false}
            speed="slow"
          />
        ) : null}
        {hasData ? (
              <>
                {error && !calcFailed ? <div className="pf-state-card pf-state-warn">{error}</div> : null}

                {calcFailed && (
                  <div className="pf-state-card pf-state-warn">
                    Portfolio value could not be calculated. Prices may be unavailable.
                    <button className="pf-refresh-btn" onClick={handleRefresh} style={{ marginLeft: 10 }}>
                      Retry
                    </button>
                  </div>
                )}

                {!calcFailed && (partialQuotes || (missingCost && portfolioMetrics.totalUnrealizedGL !== null)) ? (
                  <div className="pf-state-card pf-state-info pf-coverage-note" role="status">
                    <strong>Data coverage</strong>
                    <span>
                      {[
                        partialQuotes
                          ? `Prices missing for ${portfolioMetrics.positionsMissingPrice} position${portfolioMetrics.positionsMissingPrice === 1 ? "" : "s"}`
                          : null,
                        missingCost && portfolioMetrics.totalUnrealizedGL !== null
                          ? `Cost basis on ${portfolioMetrics.positionsWithCost}/${portfolioMetrics.positionCount}`
                          : null,
                      ].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ) : null}

                {composeBar}
                <section className="pf-values-positions" id="portfolio-positions" aria-label="Portfolio holdings">
                  <header className="pf-values-positions-header">
                    <div>
                      <span className="pf-section-eyebrow">Holdings</span>
                      <h2>Where the value lives</h2>
                    </div>
                    <span className="pf-values-position-count">
                      {sortedPositions.length} holding{sortedPositions.length === 1 ? "" : "s"}
                    </span>
                  </header>

                  <div className="pf-values-controls">
                    <div className="pf-sort-row" role="group" aria-label="Sort positions">
                      {(
                        [
                          ["ticker", "Ticker"],
                          ["value", "Value"],
                          ["weight", "Alloc"],
                          ["dayGl", "Day"],
                          ["totalGl", "Gain/Loss"],
                        ] as const
                      ).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          className={`pf-sort-chip${sort.key === key ? " is-active" : ""}`}
                          onClick={() => toggleSort(key)}
                        >
                          {label}{sortArrow(key)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="watchlist-list pf-ring-list">
                  {sortedPositions.map(({ pos, metrics, dailyPct }) => {
                    const ticker = pos.companyId.toUpperCase();
                    const quote = quotes.find((item) => item.ticker.toUpperCase() === ticker);
                    const live = quote ? getLivePrice(quote) : null;
                    const isEditing = editingTicker?.toUpperCase() === ticker;

                    return (
                      <PortfolioHoldingCard
                        key={ticker}
                        ticker={ticker}
                        companyName={quote?.name ?? ticker}
                        price={live?.price ?? quote?.price ?? pos.currentPrice ?? null}
                        changePercent={live?.changePercent ?? quote?.changePercent ?? dailyPct}
                        sessionLabel={live?.label ?? null}
                        closePrice={live?.label ? quote?.price ?? null : null}
                        closeChangePercent={live?.label ? quote?.changePercent ?? null : null}
                        shares={pos.shares}
                        metrics={metrics}
                        isEditing={isEditing}
                        formShares={isEditing ? formShares : ""}
                        formCost={isEditing ? formCost : ""}
                        formError={isEditing ? formError : null}
                        confirmRemove={removingTicker?.toUpperCase() === ticker}
                        focused={false}
                        onEdit={handleStartEdit}
                        onCancelEdit={handleCancelEdit}
                        onSharesChange={setFormShares}
                        onCostChange={setFormCost}
                        onSaveEdit={() => {
                          savePositionFromForm();
                        }}
                        onAskRemove={(symbol) => {
                          setRemovingTicker(symbol);
                          if (editingTicker) handleCancelEdit();
                        }}
                        onCancelRemove={() => setRemovingTicker(null)}
                        onConfirmRemove={handleRemove}
                      />
                    );
                  })}
                  </div>

                  {positions.length > 0 && (
                    <footer className="pf-values-positions-footer">
                      <span>Edit or remove a holding from its card.</span>
                      <button className="pf-clear-btn" onClick={handleClearAll}>Clear portfolio</button>
                    </footer>
                  )}
                </section>
              </>
            ) : null}
      </div>
      ) : null}
      </>
      )}
    </div>
  );
}

// ── Add Form Sub-component ──────────────────────────────────────────────────

function highlightMatch(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="ticker-suggestion-match">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function AddForm({
  editingTicker,
  formTicker,
  formShares,
  formCost,
  formError,
  onTickerChange,
  onSharesChange,
  onCostChange,
  onSubmit,
  onCancel,
}: {
  editingTicker: string | null;
  formTicker: string;
  formShares: string;
  formCost: string;
  formError: string | null;
  onTickerChange: (v: string) => void;
  onSharesChange: (v: string) => void;
  onCostChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}) {
  // Type-ahead state
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [suggestStatus, setSuggestStatus] = useState<"idle" | "results" | "empty">("idle");
  const suggestCacheRef = useRef<Map<string, CompanySuggestion[]>>(new Map());
  const suggestDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const applySuggestions = (next: CompanySuggestion[]) => {
    setSuggestions(next);
    setSuggestStatus(next.length > 0 ? "results" : "empty");
    setShowSuggestions(true);
    setActiveSuggestion(-1);
  };

  // Debounced type-ahead search
  useEffect(() => {
    const query = formTicker.trim();
    if (query.length < 1 || editingTicker != null) {
      setSuggestions([]);
      setShowSuggestions(false);
      setActiveSuggestion(-1);
      setSuggestStatus("idle");
      return;
    }

    const cacheKey = query.toLowerCase();
    const cached = suggestCacheRef.current.get(cacheKey);
    if (cached) {
      applySuggestions(cached);
      return;
    }

    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    const controller = new AbortController();
    suggestDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/companies/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { suggestions?: CompanySuggestion[] };
        const next = data.suggestions ?? [];
        suggestCacheRef.current.set(cacheKey, next);
        applySuggestions(next);
      } catch {
        // Type-ahead is best-effort
      }
    }, 150);

    return () => {
      controller.abort();
      if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    };
  }, [formTicker, editingTicker]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showSuggestions && e.key === "Escape") {
      e.preventDefault();
      setShowSuggestions(false);
      return;
    }
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveSuggestion((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter" && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        e.preventDefault();
        const s = suggestions[activeSuggestion];
        setShowSuggestions(false);
        setSuggestions([]);
        setActiveSuggestion(-1);
        setSuggestStatus("idle");
        onTickerChange(s.ticker);
        return;
      }
    }
  };

  return (
    <form className="pf-add-form list-compose-form" onSubmit={onSubmit}>
      <div className="pf-add-field" style={{ position: "relative" }}>
        <label className="pf-add-label">Ticker</label>
        <input
          className="pf-add-input"
          type="text"
          placeholder="AAPL"
          value={formTicker}
          onChange={(e) => onTickerChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          onBlur={() => { window.setTimeout(() => setShowSuggestions(false), 120); }}
          autoComplete="off"
          spellCheck={false}
          maxLength={5}
          disabled={editingTicker != null}
          role="combobox"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
        />
        {showSuggestions && suggestStatus === "results" && suggestions.length > 0 ? (
          <ul className="ticker-suggestions" role="listbox">
            {suggestions.map((s, i) => (
              <li
                key={`${s.ticker}-${s.cik}`}
                role="option"
                aria-selected={i === activeSuggestion}
                className={`ticker-suggestion ${i === activeSuggestion ? "active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowSuggestions(false);
                  setSuggestions([]);
                  setActiveSuggestion(-1);
                  setSuggestStatus("idle");
                  onTickerChange(s.ticker);
                }}
                onMouseEnter={() => setActiveSuggestion(i)}
              >
                <span className="ticker-suggestion-ticker">{highlightMatch(s.ticker, formTicker)}</span>
                <span className="ticker-suggestion-name">{highlightMatch(s.name, formTicker)}</span>
              </li>
            ))}
          </ul>
        ) : showSuggestions && suggestStatus === "empty" ? (
          <div className="ticker-suggestions ticker-suggestions-empty">
            No matches
          </div>
        ) : null}
      </div>
      <div className="pf-add-field">
        <label className="pf-add-label">Shares</label>
        <input
          className="pf-add-input"
          type="number"
          placeholder="10"
          min="0"
          step="any"
          value={formShares}
          onChange={(e) => onSharesChange(e.target.value)}
        />
      </div>
      <div className="pf-add-field">
        <label className="pf-add-label">Avg Cost</label>
        <input
          className="pf-add-input"
          type="number"
          placeholder="150.00"
          min="0"
          step="any"
          value={formCost}
          onChange={(e) => onCostChange(e.target.value)}
        />
      </div>
      <div className="pf-add-actions">
        <button type="submit" className="pf-add-btn">
          {editingTicker ? "Update" : "Add"}
        </button>
        <button type="button" className="pf-add-cancel" onClick={onCancel}>Cancel</button>
      </div>
      {formError && <p className="pf-add-error">{formError}</p>}
    </form>
  );
}

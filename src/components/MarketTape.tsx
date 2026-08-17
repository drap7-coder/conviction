"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { getLivePrice } from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";

const WORKSPACE_PATHS = new Set([
  "/watchlist",
  "/portfolio",
  "/pulse",
  "/news",
  "/smart-money",
]);

const TAPE_ITEMS = [
  { ticker: "SPY", label: "S&P 500", href: "/companies/SPY", kind: "price" },
  { ticker: "QQQ", label: "Nasdaq 100", href: "/companies/QQQ", kind: "price" },
  { ticker: "DIA", label: "Dow", href: "/companies/DIA", kind: "price" },
  { ticker: "^VIX", label: "VIX", href: null, kind: "number" },
  { ticker: "^TNX", label: "10Y", href: null, kind: "yield" },
] as const;

interface TrendingTapeItem {
  ticker: string;
  companyName: string;
  quote: StockQuote;
  activityRank: number;
}

type FlashTone = "up" | "down";

function formatValue(value: number | null, kind: (typeof TAPE_ITEMS)[number]["kind"]): string {
  if (value === null) return "—";
  if (kind === "yield") return `${value.toFixed(2)}%`;
  if (kind === "number") return value.toFixed(1);
  return `$${value.toFixed(2)}`;
}

function formatChange(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function MarketTape() {
  const pathname = usePathname();
  const visible = WORKSPACE_PATHS.has(pathname);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [trending, setTrending] = useState<TrendingTapeItem[]>([]);
  const [flashes, setFlashes] = useState<Record<string, FlashTone>>({});
  const [loading, setLoading] = useState(true);
  const previousPrices = useRef(new Map<string, number>());

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let quoteController: AbortController | null = null;
    let trendingController: AbortController | null = null;
    let flashTimer: number | undefined;
    let trendingTickers: string[] = [];

    async function loadQuotes(extraTickers = trendingTickers) {
      quoteController?.abort();
      quoteController = new AbortController();
      const tickers = [
        ...TAPE_ITEMS.map((item) => item.ticker),
        ...extraTickers,
      ];
      try {
        const data = await fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(tickers.join(","))}`,
          8_000,
          quoteController.signal,
        );
        if (!cancelled) {
          const nextQuotes = data.quotes ?? [];
          const nextFlashes: Record<string, FlashTone> = {};
          const nextPrices = new Map(previousPrices.current);

          nextQuotes.forEach((quote) => {
            const live = getLivePrice(quote);
            const nextPrice = live.price ?? quote.price;
            const previousPrice = previousPrices.current.get(quote.ticker.toUpperCase());
            if (nextPrice !== null) {
              if (previousPrice !== undefined && nextPrice !== previousPrice) {
                nextFlashes[quote.ticker.toUpperCase()] = nextPrice > previousPrice ? "up" : "down";
              }
              nextPrices.set(quote.ticker.toUpperCase(), nextPrice);
            }
          });

          previousPrices.current = nextPrices;
          setQuotes(nextQuotes);
          if (Object.keys(nextFlashes).length > 0) {
            setFlashes(nextFlashes);
            if (flashTimer !== undefined) window.clearTimeout(flashTimer);
            flashTimer = window.setTimeout(() => setFlashes({}), 900);
          }
        }
      } catch {
        // Keep the last good tape during a transient refresh failure.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    async function loadTrending() {
      trendingController?.abort();
      trendingController = new AbortController();
      try {
        const data = await fetchJsonWithTimeout<{ companies?: TrendingTapeItem[] }>(
          "/api/market/trending?limit=4",
          20_000,
          trendingController.signal,
        );
        if (!cancelled) {
          const companies = (data.companies ?? []).slice(0, 4);
          trendingTickers = companies.map((company) => company.ticker);
          setTrending(companies);
          if (trendingTickers.length > 0) void loadQuotes(trendingTickers);
        }
      } catch {
        // Benchmarks remain useful if the ranked list is temporarily unavailable.
      }
    }

    setLoading(true);
    void loadQuotes();
    void loadTrending();
    const quoteRefresh = window.setInterval(() => { void loadQuotes(); }, 60_000);
    const trendingRefresh = window.setInterval(() => { void loadTrending(); }, 5 * 60_000);

    return () => {
      cancelled = true;
      quoteController?.abort();
      trendingController?.abort();
      if (flashTimer !== undefined) window.clearTimeout(flashTimer);
      window.clearInterval(quoteRefresh);
      window.clearInterval(trendingRefresh);
    };
  }, [visible]);

  const quoteMap = useMemo(
    () => new Map([
      ...trending.map((company) => [company.ticker.toUpperCase(), company.quote] as const),
      ...quotes.map((quote) => [quote.ticker.toUpperCase(), quote] as const),
    ]),
    [quotes, trending],
  );

  if (!visible) return null;

  return (
    <section className={`market-tape${loading ? " is-loading" : ""}`} aria-label="Market tape" aria-busy={loading}>
      <span className="market-tape-heading">Markets</span>
      <div className="market-tape-track">
        {TAPE_ITEMS.map((item) => {
          const quote = quoteMap.get(item.ticker);
          const live = quote ? getLivePrice(quote) : null;
          const changePercent = live?.changePercent ?? quote?.changePercent ?? null;
          const tone = changePercent === null ? "quiet" : changePercent > 0 ? "up" : changePercent < 0 ? "down" : "quiet";
          const contents = (
            <>
              <span className="market-tape-symbol">{item.ticker.replace("^", "")}</span>
              <span className="market-tape-name">{item.label}</span>
              <strong>{loading ? "—" : formatValue(live?.price ?? quote?.price ?? null, item.kind)}</strong>
              <span className={`market-tape-change is-${tone}`}>
                {loading ? "—" : formatChange(changePercent)}
              </span>
            </>
          );

          const flash = flashes[item.ticker.toUpperCase()];
          const className = `market-tape-item${flash ? ` is-flashing is-${flash}` : ""}`;

          return item.href ? (
            <Link className={className} href={item.href} key={item.ticker}>
              {contents}
            </Link>
          ) : (
            <div className={className} key={item.ticker}>
              {contents}
            </div>
          );
        })}
        {trending.length > 0 ? <span className="market-tape-group-label">Trending now</span> : null}
        {trending.map((company) => {
          const quote = quoteMap.get(company.ticker.toUpperCase()) ?? company.quote;
          const live = getLivePrice(quote);
          const changePercent = live.changePercent ?? quote.changePercent;
          const tone = changePercent === null ? "quiet" : changePercent > 0 ? "up" : changePercent < 0 ? "down" : "quiet";
          const flash = flashes[company.ticker.toUpperCase()];

          return (
            <Link
              className={`market-tape-item market-tape-item--trending${flash ? ` is-flashing is-${flash}` : ""}`}
              href={`/companies/${encodeURIComponent(company.ticker)}?from=%2Fpulse`}
              key={company.ticker}
              title={`${company.companyName} · trending #${company.activityRank}`}
            >
              <span className="market-tape-rank">{company.activityRank}</span>
              <span className="market-tape-symbol">{company.ticker}</span>
              <strong>{formatValue(live.price ?? quote.price, "price")}</strong>
              <span className={`market-tape-change is-${tone}`}>{formatChange(changePercent)}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

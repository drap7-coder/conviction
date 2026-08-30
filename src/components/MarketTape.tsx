"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getLivePrice } from "@/lib/market/live-quote";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import {
  subscribeMarketData,
  type MarketDataSubscription,
} from "@/lib/market/client-market-data";
import type { StockQuote } from "@/lib/market/quotes";

const WORKSPACE_PATHS = new Set([
  "/crowd",
  "/portfolio",
  "/pulse",
  "/news",
  "/smart-money",
  "/watchlist",
  "/manage",
]);

const ANCHOR_ITEMS = [
  { ticker: "DIA", symbol: "DIA" },
  { ticker: "SPY", symbol: "SPY" },
  { ticker: "QQQ", symbol: "QQQ" },
  { ticker: "GLD", symbol: "GLD" },
  { ticker: "BTC-USD", symbol: "BTC" },
] as const;

const TRENDING_LIMIT = 5;

type TapeItem = {
  ticker: string;
  symbol: string;
};

type FlashTone = "up" | "down";

function formatChange(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function TapeSequence({
  items,
  quoteMap,
  flashes,
  loading,
  hidden = false,
}: {
  items: TapeItem[];
  quoteMap: Map<string, StockQuote>;
  flashes: Record<string, FlashTone>;
  loading: boolean;
  hidden?: boolean;
}) {
  return (
    <div className="market-tape-seq" aria-hidden={hidden || undefined} inert={hidden || undefined}>
      {items.map((item, index) => {
        const quote = quoteMap.get(item.ticker);
        const live = quote ? getLivePrice(quote) : null;
        const changePercent = live?.changePercent ?? quote?.changePercent ?? null;
        const tone = changePercent === null ? "quiet" : changePercent > 0 ? "up" : changePercent < 0 ? "down" : "quiet";
        const flash = flashes[item.ticker];
        const href = companyDetailHref(item.ticker) ?? `/companies/${encodeURIComponent(item.ticker)}`;
        const className = `market-tape-item${flash ? ` is-flashing is-${flash}` : ""}`;

        return (
          <Link
            className={className}
            href={href}
            key={`${hidden ? "dup" : "live"}-${item.ticker}-${index}`}
          >
            <span className="market-tape-symbol">{item.symbol}</span>
            <span className={`market-tape-change is-${tone}`}>
              {loading ? "—" : formatChange(changePercent)}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export function MarketTape() {
  const pathname = usePathname();
  const visible = WORKSPACE_PATHS.has(pathname);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [trending, setTrending] = useState<TapeItem[]>([]);
  const [flashes, setFlashes] = useState<Record<string, FlashTone>>({});
  const [loading, setLoading] = useState(true);
  const previousPrices = useRef(new Map<string, number>());
  const flashTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!visible) return;

    function applyQuotes(nextQuotes: StockQuote[]) {
      const nextFlashes: Record<string, FlashTone> = {};
      const nextPrices = new Map(previousPrices.current);

      nextQuotes.forEach((quote) => {
        const live = getLivePrice(quote);
        const nextPrice = live.price ?? quote.price;
        const key = quote.ticker.toUpperCase();
        const previousPrice = previousPrices.current.get(key);
        if (nextPrice !== null) {
          if (previousPrice !== undefined && nextPrice !== previousPrice) {
            nextFlashes[key] = nextPrice > previousPrice ? "up" : "down";
          }
          nextPrices.set(key, nextPrice);
        }
      });

      previousPrices.current = nextPrices;
      setQuotes((current) => {
        const byTicker = new Map(current.map((quote) => [quote.ticker.toUpperCase(), quote] as const));
        nextQuotes.forEach((quote) => byTicker.set(quote.ticker.toUpperCase(), quote));
        return Array.from(byTicker.values());
      });
      if (Object.keys(nextFlashes).length > 0) {
        setFlashes((current) => ({ ...current, ...nextFlashes }));
        if (flashTimer.current !== undefined) window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlashes({}), 900);
      }
      setLoading(false);
    }

    const subscription: MarketDataSubscription = subscribeMarketData({
      quoteTickers: ANCHOR_ITEMS.map((item) => item.ticker),
      trendingLimit: TRENDING_LIMIT,
      onQuotes: applyQuotes,
      onTrending: (payload) => {
        const reserved = new Set<string>(ANCHOR_ITEMS.map((item) => item.ticker));
        const companies = (payload.companies ?? [])
          .map((company) => ({
            ticker: company.ticker.trim().toUpperCase(),
            quote: company.quote,
          }))
          .filter((company) => company.ticker && !reserved.has(company.ticker))
          .slice(0, TRENDING_LIMIT);

        setTrending(companies.map((company) => ({ ticker: company.ticker, symbol: company.ticker })));
        applyQuotes(
          companies
            .map((company) => company.quote)
            .filter((quote): quote is StockQuote => Boolean(quote)),
        );
      },
    });

    return () => {
      subscription.unsubscribe();
      if (flashTimer.current !== undefined) window.clearTimeout(flashTimer.current);
    };
  }, [visible]);

  const quoteMap = useMemo(
    () => new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote] as const)),
    [quotes],
  );

  const items = useMemo<TapeItem[]>(
    () => [...ANCHOR_ITEMS, ...trending],
    [trending],
  );

  if (!visible) return null;

  return (
    <section className={`market-tape${loading ? " is-loading" : ""}`} aria-label="Market tape" aria-busy={loading}>
      <div className="market-tape-track">
        <TapeSequence items={items} quoteMap={quoteMap} flashes={flashes} loading={loading} />
        <TapeSequence items={items} quoteMap={quoteMap} flashes={flashes} loading={loading} hidden />
      </div>
    </section>
  );
}

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
  { ticker: "SPY", label: "S&P 500", href: "/companies/SPY" },
  { ticker: "QQQ", label: "Nasdaq 100", href: "/companies/QQQ" },
  { ticker: "DIA", label: "Dow", href: "/companies/DIA" },
] as const;

type FlashTone = "up" | "down";

function formatValue(value: number | null): string {
  if (value === null) return "—";
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
  const [flashes, setFlashes] = useState<Record<string, FlashTone>>({});
  const [loading, setLoading] = useState(true);
  const previousPrices = useRef(new Map<string, number>());

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let quoteController: AbortController | null = null;
    let flashTimer: number | undefined;

    async function loadQuotes() {
      quoteController?.abort();
      quoteController = new AbortController();
      try {
        const data = await fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(TAPE_ITEMS.map((item) => item.ticker).join(","))}`,
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

    setLoading(true);
    void loadQuotes();
    const quoteRefresh = window.setInterval(() => { void loadQuotes(); }, 60_000);

    return () => {
      cancelled = true;
      quoteController?.abort();
      if (flashTimer !== undefined) window.clearTimeout(flashTimer);
      window.clearInterval(quoteRefresh);
    };
  }, [visible]);

  const quoteMap = useMemo(
    () => new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote] as const)),
    [quotes],
  );

  if (!visible) return null;

  return (
    <section className={`market-tape${loading ? " is-loading" : ""}`} aria-label="Major indexes" aria-busy={loading}>
      <div className="market-tape-track">
        {TAPE_ITEMS.map((item) => {
          const quote = quoteMap.get(item.ticker);
          const live = quote ? getLivePrice(quote) : null;
          const changePercent = live?.changePercent ?? quote?.changePercent ?? null;
          const tone = changePercent === null ? "quiet" : changePercent > 0 ? "up" : changePercent < 0 ? "down" : "quiet";
          const flash = flashes[item.ticker.toUpperCase()];
          const className = `market-tape-item${flash ? ` is-flashing is-${flash}` : ""}`;

          return (
            <Link className={className} href={item.href} key={item.ticker}>
              <span className="market-tape-symbol">{item.ticker}</span>
              <span className="market-tape-name">{item.label}</span>
              <strong>{loading ? "—" : formatValue(live?.price ?? quote?.price ?? null)}</strong>
              <span className={`market-tape-change is-${tone}`}>
                {loading ? "—" : formatChange(changePercent)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

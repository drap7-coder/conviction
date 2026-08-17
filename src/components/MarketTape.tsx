"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let controller: AbortController | null = null;

    async function load() {
      controller?.abort();
      controller = new AbortController();
      try {
        const data = await fetchJsonWithTimeout<{ quotes?: StockQuote[] }>(
          `/api/market/quotes?tickers=${encodeURIComponent(TAPE_ITEMS.map((item) => item.ticker).join(","))}`,
          8_000,
          controller.signal,
        );
        if (!cancelled) setQuotes(data.quotes ?? []);
      } catch {
        if (!cancelled) setQuotes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    setLoading(true);
    void load();
    const refresh = window.setInterval(() => { void load(); }, 60_000);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(refresh);
    };
  }, [visible]);

  const quoteMap = useMemo(
    () => new Map(quotes.map((quote) => [quote.ticker.toUpperCase(), quote])),
    [quotes],
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

          return item.href ? (
            <Link className="market-tape-item" href={item.href} key={item.ticker}>
              {contents}
            </Link>
          ) : (
            <div className="market-tape-item" key={item.ticker}>
              {contents}
            </div>
          );
        })}
      </div>
    </section>
  );
}

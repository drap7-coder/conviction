"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { SessionQuoteStack } from "@/components/market/SessionQuoteStack";
import { subscribeMarketData } from "@/lib/market/client-market-data";
import { companyDetailHref } from "@/lib/market/company-detail-href";
import {
  getExtendedSessionQuote,
  getLivePrice,
} from "@/lib/market/live-quote";
import type { StockQuote } from "@/lib/market/quotes";

/** Read-only snapshot; saved-name ownership and failure states come from Home. */
export function PulseYourStocks({ tickers, loading, error, onRetry }: {
  tickers: string[]; loading: boolean; error: boolean; onRetry: () => void;
}) {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  useEffect(() => {
    if (tickers.length === 0) {
      setQuotes([]);
      return;
    }
    const subscription = subscribeMarketData({
      quoteTickers: tickers,
      onQuotes: (next) => {
        const byTicker = new Map(
          next.map((quote) => [quote.ticker.toUpperCase(), quote]),
        );
        setQuotes(
          tickers
            .map((ticker) => byTicker.get(ticker))
            .filter((quote): quote is StockQuote => Boolean(quote)),
        );
      },
    });
    return () => subscription.unsubscribe();
  }, [tickers]);

  return (
    <section
      className="pulse-home-section pulse-your-stocks"
      aria-labelledby="pulse-your-stocks-heading"
    >
      <header className="pulse-home-section-head">
        <div>
          <p className="pulse-home-eyebrow">Personal</p>
          <h2 id="pulse-your-stocks-heading">Your Stocks</h2>
        </div>
        <Link href="/portfolio?view=watchlist" className="pulse-home-next">
          Watchlist{" "}
          <span aria-hidden="true">→</span>
        </Link>
      </header>

      {loading ? (
        <p className="pulse-home-state">Loading your names…</p>
      ) : null}

      {!loading && error ? (
        <div className="pulse-home-state" role="status">
          <p>Some saved names could not be loaded. Your saved companies are unchanged.</p>
          <button type="button" onClick={onRetry}>Retry saved names</button>
        </div>
      ) : null}

      {tickers.length > 0 ? (
        <ul className="pulse-your-stocks-list">
          {tickers.map((ticker) => {
            const quote = quotes.find(
              (item) => item.ticker.toUpperCase() === ticker,
            );
            const live = quote ? getLivePrice(quote) : null;
            const extended = quote ? getExtendedSessionQuote(quote) : null;
            const hasQuote = Boolean(quote && live?.price != null);
            const href =
              companyDetailHref(ticker) ??
              `/companies/${encodeURIComponent(ticker)}`;
            return (
              <li key={ticker}>
                <Link href={href} className="pulse-your-stocks-row">
                  <span className="pulse-your-stocks-logo" aria-hidden="true">
                    <LogoDisplay ticker={ticker} size="badge" />
                  </span>
                  <span className="pulse-your-stocks-name">
                    <strong>{ticker}</strong>
                    <small>
                      {quote?.name?.trim() ||
                        (hasQuote ? "Saved name" : "Quote unavailable")}
                    </small>
                  </span>
                  {hasQuote && live ? (
                    <SessionQuoteStack
                      compact
                      lastPrice={quote!.price}
                      change={quote!.change}
                      changePercent={quote!.changePercent}
                      extendedLabel={extended?.sessionLabel ?? null}
                      extendedPrice={extended?.price ?? null}
                      extendedChange={extended?.change ?? null}
                      extendedChangePercent={extended?.changePercent ?? null}
                      extendedNoTrades={Boolean(extended?.noTrades)}
                      activeSessionPrimary={Boolean(extended?.sessionLabel)}
                    />
                  ) : (
                    <span className="pulse-your-stocks-missing">Unavailable</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

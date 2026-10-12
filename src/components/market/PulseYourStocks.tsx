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
import { personalSnapshotTickers } from "@/lib/market/pulse-home";
import type { StockQuote } from "@/lib/market/quotes";
import { loadPortfolioForViewer } from "@/lib/portfolio/client";
import { loadPositions } from "@/lib/portfolio/persist";

const WATCHLIST_STORAGE_KEY = "conviction-watchlist";

function readBrowserWatchlistTickers(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(WATCHLIST_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) =>
        typeof entry?.ticker === "string" ? entry.ticker.toUpperCase() : "",
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

type LoadState = "loading" | "ready" | "error";

/**
 * Compact holdings/watchlist snapshot for Pulse home.
 * Empty guests get a build-watchlist invitation — not PersonalDailyBrief.
 */
export function PulseYourStocks() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    async function loadNames() {
      try {
        const [watchlistRes, portfolio] = await Promise.all([
          fetch("/api/watchlist").then((response) =>
            response.ok ? response.json() : null,
          ),
          loadPortfolioForViewer(),
        ]);
        if (cancelled) return;
        const watched = watchlistRes?.authenticated
          ? (watchlistRes.entries ?? []).map((entry: { ticker: string }) =>
              entry.ticker.toUpperCase(),
            )
          : readBrowserWatchlistTickers();
        const holdings = (
          portfolio.positions.length > 0
            ? portfolio.positions
            : loadPositions()
        ).map((position) => position.ticker.toUpperCase());
        setTickers(personalSnapshotTickers(holdings, watched, 6));
        setLoadState("ready");
      } catch {
        if (cancelled) return;
        const holdings = loadPositions().map((position) =>
          position.ticker.toUpperCase(),
        );
        const watched = readBrowserWatchlistTickers();
        setTickers(personalSnapshotTickers(holdings, watched, 6));
        setLoadState("ready");
      }
    }
    void loadNames();
    return () => {
      cancelled = true;
    };
  }, []);

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
          {tickers.length ? "Watchlist" : "Build watchlist"}{" "}
          <span aria-hidden="true">→</span>
        </Link>
      </header>

      {loadState === "loading" ? (
        <p className="pulse-home-state">Loading your names…</p>
      ) : null}

      {loadState !== "loading" && tickers.length === 0 ? (
        <div className="pulse-home-invite">
          <p>
            <strong>Build your watchlist.</strong> Follow a few companies to see
            what changed for you.
          </p>
          <Link
            href="/portfolio?view=watchlist"
            className="pulse-home-invite-cta"
          >
            Add companies <span aria-hidden="true">→</span>
          </Link>
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

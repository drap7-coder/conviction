"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoDisplay } from "@/app/components/LogoDisplay";
import { shortenCompanyName } from "@/lib/display/company-name";
import { fmtPercent } from "@/lib/display/format";
import { getLivePrice } from "@/lib/market/live-quote";
import { fetchMarketTrending } from "@/lib/market/client-market-data";
import { primaryHeadline } from "@/lib/market/news-hero";
import type { TrendingCompany } from "@/lib/market/trending";
import { usePulseHomeNews } from "@/components/market/PulseTodaysBrief";

const MARKET_DRIVER_TICKERS = new Set([
  "AAPL", "AMD", "AMZN", "AVGO", "BA", "BAC", "CRM", "DIS", "GOOG", "IBM",
  "INTC", "JPM", "LLY", "META", "MSFT", "NFLX", "NVDA", "ORCL", "TSLA", "WMT", "XOM",
]);

function relativeTime(iso: string): string {
  const time = new Date(iso).getTime();
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(1, Math.floor((Date.now() - time) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function HomeMarketDrivers() {
  const [drivers, setDrivers] = useState<TrendingCompany[]>([]);
  const [driverStatus, setDriverStatus] = useState<"loading" | "ready" | "unavailable">("loading");
  const news = usePulseHomeNews();

  useEffect(() => {
    const controller = new AbortController();
    void fetchMarketTrending(16, { reason: "initial", signal: controller.signal })
      .then((payload) => {
        setDrivers(
          (payload.companies as TrendingCompany[])
            .filter((company) => MARKET_DRIVER_TICKERS.has(company.ticker.toUpperCase()))
            .slice(0, 4),
        );
        setDriverStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDriverStatus("unavailable");
      });
    return () => controller.abort();
  }, []);

  return (
    <section className="home-drivers" aria-labelledby="home-drivers-heading">
      <header className="home-drivers-head">
        <div>
          <p><span aria-hidden="true" /> What’s driving today</p>
          <h2 id="home-drivers-heading">Moves and news that matter.</h2>
        </div>
        <div className="home-drivers-meta">
          <span>Large-cap activity</span>
          <span>Ranked context</span>
        </div>
      </header>

      <div className="home-drivers-layout">
        <section className="home-driver-panel is-movers" aria-labelledby="home-driver-movers-heading">
          <header>
            <div>
              <span>Market drivers</span>
              <h3 id="home-driver-movers-heading">Stocks commanding attention</h3>
            </div>
            <Link href="/pulse?view=movers">All movers →</Link>
          </header>
          {driverStatus === "loading" ? <p className="home-driver-state">Ranking live activity…</p> : null}
          {driverStatus === "unavailable" ? <p className="home-driver-state">Live drivers are temporarily unavailable.</p> : null}
          {driverStatus === "ready" ? (
            <div className="home-driver-stocks">
              {drivers.map((driver, index) => {
                const live = getLivePrice(driver.quote);
                const move = live.changePercent;
                const tone = (move ?? 0) > 0 ? "up" : (move ?? 0) < 0 ? "down" : "flat";
                return (
                  <Link
                    href={`/companies/${encodeURIComponent(driver.ticker)}`}
                    className={`home-driver-stock is-${tone}`}
                    key={driver.ticker}
                    aria-label={`${driver.ticker}, ${fmtPercent(move, 2)}, ${driver.activityLabel}`}
                  >
                    <span className="home-driver-rank">0{index + 1}</span>
                    <span className="home-driver-logo" aria-hidden="true"><LogoDisplay ticker={driver.ticker} size="badge" /></span>
                    <span className="home-driver-id">
                      <strong>{driver.ticker}</strong>
                      <small>{shortenCompanyName(driver.companyName)}</small>
                    </span>
                    <strong className="home-driver-move tnum">{fmtPercent(move, 2)}</strong>
                    <span className="home-driver-activity">{driver.activityLabel}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="home-driver-panel is-news" aria-labelledby="home-driver-news-heading">
          <header>
            <div>
              <span>Market brief</span>
              <h3 id="home-driver-news-heading">Three headlines to know</h3>
            </div>
            <Link href="/news">All news →</Link>
          </header>
          {news.status === "loading" ? <p className="home-driver-state">Reading the market narrative…</p> : null}
          {news.status === "unavailable" ? <p className="home-driver-state">Market headlines are temporarily unavailable.</p> : null}
          <ol className="home-driver-headlines">
            {news.todaysBrief.slice(0, 3).map((theme, index) => {
              const headline = primaryHeadline(theme);
              if (!headline) return null;
              const content = (
                <>
                  <span className="home-headline-index">0{index + 1}</span>
                  <span className="home-headline-copy">
                    <small>{theme.label}</small>
                    <strong>{headline.title}</strong>
                    <em><b>Why it matters:</b> {theme.summary}</em>
                  </span>
                  <span className="home-headline-meta">
                    {headline.publisher?.trim() || "Market source"} · {relativeTime(headline.date)}
                  </span>
                </>
              );
              return (
                <li key={theme.id}>
                  {headline.url ? (
                    <a href={headline.url} target="_blank" rel="noopener noreferrer">{content}</a>
                  ) : (
                    <div>{content}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </div>
    </section>
  );
}

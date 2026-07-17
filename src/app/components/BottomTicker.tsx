"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";

interface TrendingTapeCompany {
  ticker: string;
  companyName: string;
  quote: {
    price: number | null;
    change: number | null;
    changePercent: number | null;
  };
}

function formatPrice(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export function BottomTicker() {
  const [companies, setCompanies] = useState<TrendingTapeCompany[]>([]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const data = await fetchJsonWithTimeout<{ companies?: TrendingTapeCompany[] }>(
          "/api/market/trending?limit=12",
          10_000,
          controller.signal,
        );
        if (!cancelled && data.companies?.length) {
          setCompanies(data.companies);
        }
      } catch {
        // Keep the last successful tape snapshot during a provider interruption.
      }
    }

    void load();
    const refresh = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      controller.abort();
      window.clearInterval(refresh);
    };
  }, []);

  const tapeCompanies = companies.length > 0
    ? companies
    : [{ ticker: "MARKET", companyName: "Loading daily idea flow", quote: { price: null, change: null, changePercent: null } }];

  return (
    <div className="bottom-ticker" role="marquee" aria-label="Trending stock tape">
      <div className="ticker-scroll">
        {[0, 1].map((copy) => (
          <div className="ticker-scroll-group" key={copy} aria-hidden={copy === 1 ? "true" : undefined}>
            {tapeCompanies.map((company) => {
              const direction = !company.quote.change
                ? "neutral"
                : company.quote.change > 0
                  ? "pos"
                  : "neg";
              const content = (
                <>
                  <span className="ticker-sep">◆</span>
                  <strong className={`ticker-${direction}`}>{company.ticker}</strong>
                  <span className="ticker-price">${formatPrice(company.quote.price)}</span>
                  <b className={`ticker-${direction}`}>
                    {company.quote.changePercent != null
                      ? `${company.quote.changePercent > 0 ? "+" : ""}${company.quote.changePercent.toFixed(2)}%`
                      : "Loading…"}
                  </b>
                </>
              );

              return company.ticker === "MARKET" ? (
                <span className="ticker-item" key={company.ticker}>{content}</span>
              ) : (
                <Link
                  className="ticker-item ticker-stock-link"
                  href={`/companies/${company.ticker}`}
                  key={company.ticker}
                  title={company.companyName}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

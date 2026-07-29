import type { Metadata } from "next";
import Link from "next/link";
import { IndustriesClient } from "@/app/industries/IndustriesClient";
import { getIndustriesSnapshot } from "@/lib/market/industries-data";
import { SECTORS } from "@/lib/market/industries";
import { getSectorSignal } from "@/lib/display/sector-signal";
import { getLivePrice } from "@/lib/market/live-quote";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock Market Sectors & Industry Leadership | Conviction",
  description:
    "See which stock market sectors are leading or lagging, with sector ETF performance, industry descriptions, and representative companies for Technology, Financials, Healthcare, Energy, and more.",
  alternates: {
    canonical: `${SITE_URL}/industries`,
  },
  openGraph: {
    title: "Stock Market Sectors & Industry Leadership | Conviction",
    description:
      "Sector performance and industry leadership across the S&P — Technology, Financials, Healthcare, Energy, and more.",
    url: `${SITE_URL}/industries`,
  },
};

function fmtPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "unavailable";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export default async function IndustriesPage() {
  const snapshot = await getIndustriesSnapshot();

  return (
    <>
      <IndustriesClient initialSectors={snapshot.sectors} />

      {/* Always present in the raw HTML for crawlers and link readers. */}
      <section className="industries-ssr-index" aria-label="Sector index">
        <h2 className="industries-ssr-heading">S&amp;P sector overview</h2>
        <p className="industries-ssr-copy">
          Conviction tracks market leadership across major stock market sectors using
          sector ETF proxies, performance, and representative companies.
        </p>
        <ul className="industries-ssr-list">
          {snapshot.sectors.map((sector) => {
            const live = sector.quote ? getLivePrice(sector.quote) : null;
            const changePercent = live?.changePercent ?? sector.quote?.changePercent ?? null;
            const sessionNote = live?.label ? ` (${live.label})` : "";
            const signal = getSectorSignal({
              name: sector.name,
              changePercent,
              leaders: sector.representativeTickers.slice(0, 4),
              description: sector.description,
            });
            return (
              <li key={sector.ticker} className="industries-ssr-item">
                <Link href={`/industries/${sector.ticker}`}>
                  <strong>
                    {sector.name} ({sector.ticker})
                  </strong>
                </Link>
                <span>
                  {" "}
                  — {fmtPct(changePercent)}{sessionNote}. {sector.description} Leaders:{" "}
                  {sector.representativeTickers.slice(0, 4).join(", ")}. {signal.conclusion}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <noscript>
        <section aria-label="Industries without JavaScript">
          <h1>Stock Market Sectors &amp; Industry Leadership</h1>
          <p>
            Where market leadership is strengthening or weakening across S&amp;P sectors.
            JavaScript is disabled, so interactive charts are unavailable. Sector links below
            remain fully usable.
          </p>
          <ul>
            {SECTORS.map((sector) => (
              <li key={sector.ticker}>
                <a href={`/industries/${sector.ticker}`}>
                  {sector.name} ({sector.ticker})
                </a>
                {" — "}
                {sector.description} Representative companies:{" "}
                {sector.representativeTickers.slice(0, 5).join(", ")}.
              </li>
            ))}
          </ul>
        </section>
      </noscript>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { validateTicker } from "@/lib/watchlist/validate";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { parseEmbedAccent, parseEmbedSurface } from "@/lib/embed-theme";
import { WidgetAttribution } from "@/components/embed/WidgetAttribution";

export const revalidate = 300;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticker: string }>;
}): Promise<Metadata> {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  return {
    title: { absolute: `${symbol} Quote · IQBulls` },
    alternates: { canonical: `/companies/${encodeURIComponent(symbol)}` },
    robots: { index: false, follow: true },
  };
}
export default async function QuoteEmbed({
  params,
  searchParams,
}: {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ticker } = await params;
  const symbol = ticker.toUpperCase();
  const valid = await validateTicker(symbol);
  if (!valid.valid) notFound();
  const q = await searchParams;
  const quote = (await fetchStockQuotes([symbol]))[0];
  const change = quote?.changePercent;
  const tone = change == null ? "" : change >= 0 ? "is-up" : "is-down";
  return (
    <main
      className="embed-page"
      data-surface={parseEmbedSurface(q.surface)}
      data-accent={parseEmbedAccent(q.accent)}
    >
      <section className="embed-card" aria-label={`${symbol} quote`}>
        <header className="embed-head">
          <span className="embed-kicker">{valid.companyName ?? symbol}</span>
          <span className="embed-muted">{quote?.marketState ?? "Latest"}</span>
        </header>
        <div className="embed-stat-line">
          <h1>{symbol}</h1>
          <strong className="embed-value">
            {quote?.price == null ? "—" : `$${quote.price.toFixed(2)}`}
          </strong>
        </div>
        <span className={`embed-change ${tone}`}>
          {change == null
            ? "Price unavailable"
            : `${change >= 0 ? "+" : ""}${change.toFixed(2)}% today`}
        </span>
        <WidgetAttribution
          href={`https://iqbulls.com/companies/${encodeURIComponent(symbol)}`}
        />
      </section>
    </main>
  );
}

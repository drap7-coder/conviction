import type { Metadata } from "next";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { parseEmbedAccent, parseEmbedSurface } from "@/lib/embed-theme";
import { WidgetAttribution } from "@/components/embed/WidgetAttribution";

export const revalidate = 300;
export const metadata: Metadata = {
  title: { absolute: "Market Snapshot · IQBulls" },
  alternates: { canonical: "/pulse" },
};
export default async function MacroEmbed({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const quotes = await fetchStockQuotes(["SPY", "^VIX", "^TNX"]);
  const by = new Map(quotes.map((x) => [x.ticker, x]));
  const yieldValue = by.get("^TNX")?.price;
  const items = [
    { label: "S&P 500", value: by.get("SPY")?.price?.toFixed(2) },
    { label: "VIX", value: by.get("^VIX")?.price?.toFixed(1) },
    {
      label: "10Y yield",
      value: yieldValue == null ? undefined : `${yieldValue.toFixed(2)}%`,
    },
  ];
  return (
    <main
      className="embed-page"
      data-surface={parseEmbedSurface(q.surface)}
      data-accent={parseEmbedAccent(q.accent)}
    >
      <section className="embed-card" aria-label="Macro market snapshot">
        <span className="embed-kicker">Macro snapshot</span>
        <h1>Markets at a glance</h1>
        <div className="embed-macro-grid">
          {items.map((i) => (
            <article key={i.label}>
              <span>{i.label}</span>
              <strong>{i.value ?? "—"}</strong>
            </article>
          ))}
        </div>
        <WidgetAttribution href="https://iqbulls.com/pulse" />
      </section>
    </main>
  );
}

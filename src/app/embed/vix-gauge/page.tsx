import type { Metadata } from "next";
import { fetchStockQuotes } from "@/lib/market/quotes";
import { parseEmbedAccent, parseEmbedSurface } from "@/lib/embed-theme";
import { WidgetAttribution } from "@/components/embed/WidgetAttribution";

export const revalidate = 300;
export const metadata: Metadata = {
  title: { absolute: "VIX Gauge · IQBulls" },
  alternates: { canonical: "/pulse" },
};

export default async function VixEmbed({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const quote = (await fetchStockQuotes(["^VIX"]))[0];
  const value = quote?.price;
  const level =
    value == null ? 0 : Math.min(100, Math.max(0, (value / 40) * 100));
  return (
    <main
      className="embed-page"
      data-surface={parseEmbedSurface(query.surface)}
      data-accent={parseEmbedAccent(query.accent)}
    >
      <section className="embed-card" aria-label="VIX volatility gauge">
        <header className="embed-head">
          <span className="embed-kicker">Volatility</span>
          <span className="embed-muted">VIX</span>
        </header>
        <div className="embed-stat-line">
          <h1>Market fear gauge</h1>
          <strong className="embed-value">{value?.toFixed(1) ?? "—"}</strong>
        </div>
        <div className="embed-meter" aria-hidden="true">
          <i style={{ width: `${level}%` }} />
        </div>
        <p className="embed-muted">
          CBOE Volatility Index snapshot. Lower readings generally indicate
          calmer expected equity volatility.
        </p>
        <WidgetAttribution href="https://iqbulls.com/pulse" />
      </section>
    </main>
  );
}

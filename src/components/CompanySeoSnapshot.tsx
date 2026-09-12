import type { StockQuote } from "@/lib/market/quotes";

function money(value: number | null) {
  return value == null
    ? "unavailable"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(value);
}
export function CompanySeoSnapshot({
  ticker,
  name,
  sector,
  quote,
}: {
  ticker: string;
  name: string;
  sector: string | null;
  quote: StockQuote | null;
}) {
  return (
    <section
      className="company-seo-snapshot"
      aria-labelledby="company-snapshot-title"
    >
      <h2 id="company-snapshot-title">{ticker} Price and Market Session</h2>
      <p>
        The latest available {name} ({ticker}) price is{" "}
        {money(quote?.price ?? null)}. The current market-session status is{" "}
        {quote?.marketState?.toLowerCase().replace("_", " ") ?? "unavailable"}.
        Quotes may reflect exchange or vendor delays.
      </p>
      <h2>Key Market Metrics</h2>
      <p>
        {quote?.fiftyTwoWeekLow != null && quote.fiftyTwoWeekHigh != null
          ? `${ticker} has traded between ${money(quote.fiftyTwoWeekLow)} and ${money(quote.fiftyTwoWeekHigh)} over the latest 52-week period.`
          : "The 52-week range is currently unavailable."}{" "}
        {sector
          ? `${name} is grouped with ${sector} for related-market context.`
          : ""}
      </p>
      <h2>About {ticker}</h2>
      <p>
        Use this page to follow {name} price movement, chart history, recent
        company evidence, and related names. IQBulls provides market context for
        research and education, not investment advice.
      </p>
    </section>
  );
}

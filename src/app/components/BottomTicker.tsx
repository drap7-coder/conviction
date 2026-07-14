const TICKER_ITEMS = [
  { ticker: "13F", text: "15 tracked institutional managers", dir: "neutral" as const },
  { ticker: "INTC", text: "2 new positions and 1 increase detected", dir: "pos" as const },
  { ticker: "GOOG", text: "2 new positions among tracked managers", dir: "pos" as const },
  { ticker: "OXY", text: "D. E. Shaw increased common shares", dir: "pos" as const },
  { ticker: "PFE", text: "2 managers increased holdings", dir: "pos" as const },
  { ticker: "NBIS", text: "Bridgewater increased common shares", dir: "pos" as const },
  { ticker: "SEC", text: "Share changes, not market-value moves", dir: "neutral" as const },
  { ticker: "QA", text: "Options and ambiguous share classes excluded", dir: "neutral" as const },
];

export function BottomTicker() {
  // Double the items for seamless loop
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="bottom-ticker" role="marquee" aria-label="Evidence tape">
      <div className="ticker-scroll">
        {items.map((item, i) => (
          <span key={i} className="ticker-item">
            <span className="ticker-sep">◆</span>
            <span className={`ticker-${item.dir}`}>{item.ticker}</span>
            {" — "}
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

import { SYSTEM_SIGNAL_SUMMARIES, TICKER_SIGNAL_SUMMARIES } from "@/lib/evidence/signal-summaries";

const TICKER_ITEMS = [
  SYSTEM_SIGNAL_SUMMARIES[0],
  ...TICKER_SIGNAL_SUMMARIES,
  ...SYSTEM_SIGNAL_SUMMARIES.slice(1),
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
            <span className={`ticker-${item.direction}`}>{item.ticker}</span>
            {" — "}
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

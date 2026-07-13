const TICKER_ITEMS = [
  { type: "filing" as const, ticker: "OXY", text: "New Form 4 filing — Director purchased $5.2M", dir: "pos" as const },
  { type: "filing" as const, ticker: "INTC", text: "Third Point reported 3.8M share position", dir: "pos" as const },
  { type: "contract" as const, ticker: "NBIS", text: "New AI cluster commissioned — 20MW GPU", dir: "pos" as const },
  { type: "thesis" as const, ticker: "OXY", text: "Thesis strengthened — DAC Phase 2 validated", dir: "pos" as const },
  { type: "filing" as const, ticker: "GOOG", text: "Point72 initiated $1.4B GOOG position", dir: "pos" as const },
  { type: "thesis" as const, ticker: "INTC", text: "Thesis weakened — Q3 guidance below consensus", dir: "neg" as const },
  { type: "contract" as const, ticker: "PFE", text: "BARDA awarded $2.4B pandemic contract", dir: "pos" as const },
  { type: "filing" as const, ticker: "NVO", text: "Board member purchased $5.2M in open market", dir: "pos" as const },
  { type: "catalyst" as const, ticker: "INTC", text: "Earnings in 6 days — Foundry revenue update", dir: "neutral" as const },
  { type: "filing" as const, ticker: "NBIS", text: "Founder purchased $3M in open market", dir: "pos" as const },
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
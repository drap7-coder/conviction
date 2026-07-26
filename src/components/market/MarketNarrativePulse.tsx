import type {
  MarketNarrativePulse as MarketNarrativePulseData,
  NarrativeHeat,
} from "@/lib/market/market-narratives";

function heatLabel(heat: NarrativeHeat): string {
  if (heat === "surging") return "SURGING";
  if (heat === "building") return "BUILDING";
  if (heat === "quiet") return "QUIET";
  return "STEADY";
}

function formatMove(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

export function MarketNarrativePulse({ pulse }: { pulse: MarketNarrativePulseData }) {
  return (
    <section className="market-panel narrative-panel" aria-label="Market narratives">
      <style>{`
        .narrative-panel { --narrative-blue:#60a5fa; --narrative-purple:#a78bfa; overflow:hidden; }
        .narrative-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
        .narrative-header-copy { max-width:680px; }
        .narrative-status { flex:0 0 auto; padding:5px 7px; border:1px solid color-mix(in srgb,var(--market-live,#2dd4bf) 32%,transparent); border-radius:999px; color:var(--market-live,#2dd4bf); font-size:.5rem; letter-spacing:.09em; line-height:1; }
        .narrative-status.partial { color:#facc15; border-color:color-mix(in srgb,#facc15 32%,transparent); }
        .narrative-status.unavailable { color:var(--market-muted,#8b8f97); border-color:var(--market-border,#26282c); }
        .narrative-source-note { margin-top:9px!important; }
        .narrative-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:18px; }
        .narrative-card { min-width:0; padding:16px; border:1px solid var(--market-border,#26282c); border-radius:10px; background:color-mix(in srgb,var(--market-card,#111214) 86%,#172033); }
        .narrative-card-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .narrative-heat { padding:5px 6px; border-radius:4px; color:var(--market-muted,#8b8f97); background:color-mix(in srgb,var(--market-muted,#8b8f97) 10%,transparent); font-size:.48rem; letter-spacing:.08em; }
        .narrative-heat.surging { color:var(--narrative-purple); background:color-mix(in srgb,var(--narrative-purple) 13%,transparent); }
        .narrative-heat.building { color:var(--narrative-blue); background:color-mix(in srgb,var(--narrative-blue) 13%,transparent); }
        .narrative-chatter { color:var(--market-muted,#8b8f97); font-size:.5rem; font-variant-numeric:tabular-nums; }
        .narrative-title { margin:13px 0 0; color:var(--market-text,#f4f4f5); font-size:.78rem; letter-spacing:.04em; }
        .narrative-summary { min-height:34px; margin:8px 0 0; color:var(--market-muted,#8b8f97); font-size:.59rem; line-height:1.5; }
        .narrative-assets { display:flex; flex-wrap:wrap; gap:6px; margin-top:12px; }
        .narrative-asset { display:inline-flex; gap:5px; padding:5px 6px; border:1px solid var(--market-border,#26282c); border-radius:5px; color:var(--market-muted,#8b8f97); font-size:.5rem; font-variant-numeric:tabular-nums; }
        .narrative-asset .up { color:var(--market-green,#4ade80); }
        .narrative-asset .down { color:var(--market-red,#f87171); }
        .narrative-headline { display:block; min-height:54px; margin-top:13px; padding-top:11px; border-top:1px solid var(--market-border,#26282c); color:var(--market-text,#f4f4f5); font-size:.56rem; line-height:1.45; text-decoration:none; }
        .narrative-headline:hover { color:var(--narrative-blue); }
        .narrative-headline-label { display:block; margin-bottom:5px; color:var(--market-muted,#8b8f97); font-size:.46rem; letter-spacing:.09em; }
        .narrative-headline.empty { color:var(--market-muted,#8b8f97); }
        .narrative-footer { display:flex; justify-content:space-between; gap:14px; margin-top:12px; color:var(--market-muted,#8b8f97); font-size:.5rem; line-height:1.45; }
        @media (max-width:700px) {
          .narrative-grid { grid-template-columns:1fr; }
          .narrative-summary,.narrative-headline { min-height:0; }
          .narrative-footer { flex-direction:column; gap:4px; }
        }
      `}</style>

      <div className="market-panel-header narrative-header">
        <div className="narrative-header-copy">
          <h2>Market Narratives</h2>
          <p>The headlines and open-market chatter transmitting into stocks, sectors, and risk assets.</p>
          <p className="narrative-source-note">Free live sources · ranked by attention, breadth, and price reaction</p>
        </div>
        <span className={`narrative-status ${pulse.status}`}>
          {pulse.status === "live" ? "LIVE" : pulse.status.toUpperCase()}
        </span>
      </div>

      {pulse.themes.length > 0 ? (
        <div className="narrative-grid">
          {pulse.themes.slice(0, 4).map((theme) => (
            <article key={theme.id} className="narrative-card">
              <div className="narrative-card-top">
                <span className={`narrative-heat ${theme.heat}`}>{heatLabel(theme.heat)}</span>
                <span className="narrative-chatter">{theme.velocity.toFixed(1)}× chatter · {theme.uniqueAuthorsLastHour} voices</span>
              </div>
              <h3 className="narrative-title">{theme.label}</h3>
              <p className="narrative-summary">{theme.summary}</p>
              <div className="narrative-assets" aria-label={`${theme.label} linked assets`}>
                {theme.assets.map((asset) => (
                  <span key={asset.ticker} className="narrative-asset">
                    {asset.ticker}
                    <span className={(asset.changePercent ?? 0) > 0 ? "up" : (asset.changePercent ?? 0) < 0 ? "down" : ""}>
                      {formatMove(asset.changePercent)}
                    </span>
                  </span>
                ))}
              </div>
              {theme.headline?.url ? (
                <a className="narrative-headline" href={theme.headline.url} target="_blank" rel="noreferrer">
                  <span className="narrative-headline-label">LEAD HEADLINE</span>
                  {theme.headline.title}
                </a>
              ) : (
                <div className="narrative-headline empty">
                  <span className="narrative-headline-label">LEAD HEADLINE</span>
                  No fresh thematic headline available.
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <div className="market-empty">Market narratives are temporarily unavailable.</div>
      )}

      <div className="narrative-footer">
        <span>{pulse.methodology}</span>
        <span>Chatter measures attention—not truth or sentiment.</span>
      </div>
    </section>
  );
}

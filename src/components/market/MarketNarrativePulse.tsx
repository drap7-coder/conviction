import type {
  MarketNarrativeTheme,
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

function toneLabel(tone: MarketNarrativeTheme["marketTone"]): string {
  if (tone === "positive") return "Positive reaction";
  if (tone === "negative") return "Negative reaction";
  return "Mixed reaction";
}

function leadAsset(theme: MarketNarrativeTheme) {
  return [...theme.assets]
    .filter((asset) => asset.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0] ?? null;
}

export function MarketNarrativePulse({ pulse }: { pulse: MarketNarrativePulseData }) {
  return (
    <section className="market-panel narrative-panel" aria-label="Market narratives">
      <style>{`
        .narrative-panel { --narrative-blue:#60a5fa; --narrative-purple:#a78bfa; overflow:hidden; background:linear-gradient(150deg,color-mix(in srgb,var(--market-card,#111214) 94%,#172033),var(--market-card,#111214)); }
        .narrative-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
        .narrative-header-copy { max-width:680px; }
        .narrative-kicker { display:block; margin-bottom:8px; color:var(--narrative-blue); font-size:.52rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
        .narrative-header h2 { font-size:1.05rem; letter-spacing:.04em; }
        .narrative-header p { max-width:610px; margin-top:8px; font-size:.71rem; line-height:1.55; }
        .narrative-status { flex:0 0 auto; padding:5px 7px; border:1px solid color-mix(in srgb,var(--market-live,#2dd4bf) 32%,transparent); border-radius:999px; color:var(--market-live,#2dd4bf); font-size:.5rem; letter-spacing:.09em; line-height:1; }
        .narrative-status.partial { color:#facc15; border-color:color-mix(in srgb,#facc15 32%,transparent); }
        .narrative-status.unavailable { color:var(--market-muted,#8b8f97); border-color:var(--market-border,#26282c); }
        .narrative-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:20px; }
        .narrative-card { --theme-accent:var(--market-muted,#8b8f97); position:relative; min-width:0; overflow:hidden; padding:18px; border:1px solid color-mix(in srgb,var(--theme-accent) 18%,var(--market-border,#26282c)); border-radius:12px; background:linear-gradient(145deg,color-mix(in srgb,var(--market-card,#111214) 86%,#172033),var(--market-card,#111214)); box-shadow:inset 0 1px 0 rgba(255,255,255,.035); }
        .narrative-card::before { content:""; position:absolute; inset:0 0 auto; height:3px; background:var(--theme-accent); opacity:.8; }
        .narrative-card.heat-surging { --theme-accent:var(--narrative-purple); }
        .narrative-card.heat-building { --theme-accent:var(--narrative-blue); }
        .narrative-card-top { display:flex; align-items:center; gap:8px; }
        .narrative-rank { margin-right:auto; color:color-mix(in srgb,var(--theme-accent) 82%,var(--market-text,#f4f4f5)); font-size:.56rem; font-weight:700; letter-spacing:.12em; }
        .narrative-heat,.narrative-tone { padding:5px 6px; border-radius:999px; color:var(--market-muted,#8b8f97); background:color-mix(in srgb,var(--market-muted,#8b8f97) 10%,transparent); font-size:.46rem; letter-spacing:.07em; text-transform:uppercase; }
        .narrative-heat.surging { color:var(--narrative-purple); background:color-mix(in srgb,var(--narrative-purple) 13%,transparent); }
        .narrative-heat.building { color:var(--narrative-blue); background:color-mix(in srgb,var(--narrative-blue) 13%,transparent); }
        .narrative-tone.positive { color:var(--market-green,#4ade80); background:color-mix(in srgb,var(--market-green,#4ade80) 10%,transparent); }
        .narrative-tone.negative { color:var(--market-red,#f87171); background:color-mix(in srgb,var(--market-red,#f87171) 10%,transparent); }
        .narrative-title { margin:15px 0 0; color:var(--market-text,#f4f4f5); font-size:1.02rem; line-height:1.2; letter-spacing:-.01em; }
        .narrative-summary { min-height:42px; margin:8px 0 0; color:color-mix(in srgb,var(--market-text,#f4f4f5) 72%,var(--market-muted,#8b8f97)); font-size:.69rem; line-height:1.55; }
        .narrative-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:14px; }
        .narrative-metric { min-width:0; padding:9px 10px; border:1px solid var(--market-border,#26282c); border-radius:8px; background:rgba(0,0,0,.12); }
        .narrative-metric strong { display:block; overflow:hidden; color:var(--market-text,#f4f4f5); font-size:.79rem; font-variant-numeric:tabular-nums; line-height:1.1; text-overflow:ellipsis; white-space:nowrap; }
        .narrative-metric span { display:block; margin-top:5px; overflow:hidden; color:var(--market-muted,#8b8f97); font-size:.45rem; letter-spacing:.06em; line-height:1.2; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
        .narrative-metric strong.up { color:var(--market-green,#4ade80); }
        .narrative-metric strong.down { color:var(--market-red,#f87171); }
        .narrative-assets { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:12px; }
        .narrative-assets-label { margin-right:2px; color:var(--market-muted,#8b8f97); font-size:.45rem; letter-spacing:.07em; text-transform:uppercase; }
        .narrative-asset { display:inline-flex; gap:5px; padding:5px 6px; border:1px solid var(--market-border,#26282c); border-radius:999px; color:var(--market-text,#f4f4f5); background:rgba(0,0,0,.1); font-size:.49rem; font-variant-numeric:tabular-nums; }
        .narrative-asset .up { color:var(--market-green,#4ade80); }
        .narrative-asset .down { color:var(--market-red,#f87171); }
        .narrative-headline { position:relative; display:block; min-height:67px; margin-top:14px; padding:11px 34px 11px 12px; border:1px solid var(--market-border,#26282c); border-radius:8px; color:var(--market-text,#f4f4f5); background:rgba(0,0,0,.16); font-size:.62rem; line-height:1.5; text-decoration:none; }
        .narrative-headline[href]::after { content:"↗"; position:absolute; top:50%; right:12px; color:var(--theme-accent); font-size:.78rem; transform:translateY(-50%); }
        .narrative-headline:hover { border-color:color-mix(in srgb,var(--theme-accent) 45%,var(--market-border,#26282c)); color:var(--theme-accent); }
        .narrative-headline-label { display:block; margin-bottom:5px; color:var(--theme-accent); font-size:.45rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
        .narrative-headline.empty { color:var(--market-muted,#8b8f97); }
        .narrative-footer { display:flex; justify-content:space-between; gap:14px; margin-top:13px; color:var(--market-muted,#8b8f97); font-size:.5rem; line-height:1.45; }
        @media (max-width:700px) {
          .narrative-grid { grid-template-columns:1fr; }
          .narrative-summary,.narrative-headline { min-height:0; }
          .narrative-footer { flex-direction:column; gap:4px; }
        }
        @media (max-width:399px) {
          .narrative-card { padding:15px; }
          .narrative-metric { padding:8px; }
          .narrative-metric strong { font-size:.72rem; }
        }
      `}</style>

      <div className="market-panel-header narrative-header">
        <div className="narrative-header-copy">
          <span className="narrative-kicker">What’s moving markets</span>
          <h2>Market Narratives</h2>
          <p>The four themes carrying the most attention across headlines, public conversation, and price action.</p>
        </div>
        <span className={`narrative-status ${pulse.status}`}>
          {pulse.status === "live" ? "LIVE" : pulse.status.toUpperCase()}
        </span>
      </div>

      {pulse.themes.length > 0 ? (
        <div className="narrative-grid">
          {pulse.themes.slice(0, 4).map((theme, index) => {
            const lead = leadAsset(theme);
            return (
              <article key={theme.id} className={`narrative-card heat-${theme.heat}`}>
                <div className="narrative-card-top">
                  <span className="narrative-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className={`narrative-heat ${theme.heat}`}>{heatLabel(theme.heat)}</span>
                  <span className={`narrative-tone ${theme.marketTone}`}>{toneLabel(theme.marketTone)}</span>
                </div>
                <h3 className="narrative-title">{theme.label}</h3>
                <p className="narrative-summary">{theme.summary}</p>
                <div className="narrative-metrics">
                  <div className="narrative-metric">
                    <strong>{theme.velocity.toFixed(1)}×</strong>
                    <span>Attention pace</span>
                  </div>
                  <div className="narrative-metric">
                    <strong>{theme.uniqueAuthorsLastHour}</strong>
                    <span>Unique voices</span>
                  </div>
                  <div className="narrative-metric">
                    <strong className={(lead?.changePercent ?? 0) > 0 ? "up" : (lead?.changePercent ?? 0) < 0 ? "down" : ""}>
                      {lead ? formatMove(lead.changePercent) : "—"}
                    </strong>
                    <span>{lead?.ticker ?? "Largest move"}</span>
                  </div>
                </div>
                <div className="narrative-assets" aria-label={`${theme.label} linked assets`}>
                  <span className="narrative-assets-label">Linked markets</span>
                  {theme.assets.map((asset) => (
                    <span key={asset.ticker} className="narrative-asset" title={asset.label}>
                      {asset.ticker}
                      <span className={(asset.changePercent ?? 0) > 0 ? "up" : (asset.changePercent ?? 0) < 0 ? "down" : ""}>
                        {formatMove(asset.changePercent)}
                      </span>
                    </span>
                  ))}
                </div>
                {theme.headline?.url ? (
                  <a className="narrative-headline" href={theme.headline.url} target="_blank" rel="noreferrer">
                    <span className="narrative-headline-label">Driving headline</span>
                    {theme.headline.title}
                  </a>
                ) : (
                  <div className="narrative-headline empty">
                    <span className="narrative-headline-label">Driving headline</span>
                    No fresh thematic headline available.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="market-empty">Market narratives are temporarily unavailable.</div>
      )}

      <div className="narrative-footer">
        <span>{pulse.methodology} · refreshed every 5 minutes</span>
        <span>Attention, not sentiment.</span>
      </div>
    </section>
  );
}

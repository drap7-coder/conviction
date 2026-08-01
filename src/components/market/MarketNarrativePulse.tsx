import type {
  MarketNarrativeTheme,
  MarketNarrativePulse as MarketNarrativePulseData,
  NarrativeHeat,
} from "@/lib/market/market-narratives";
import { inkBoxClass, inkChipClass, inkToneFromSemantic, type InkTone } from "@/lib/display/ink-tone";

function heatLabel(heat: NarrativeHeat): string {
  if (heat === "surging") return "Surging";
  if (heat === "building") return "Building";
  if (heat === "quiet") return "Quiet";
  return "Steady";
}

function heatTone(heat: NarrativeHeat): InkTone {
  if (heat === "surging") return "amber";
  if (heat === "building") return "up";
  if (heat === "quiet") return "quiet";
  return "quiet";
}

function formatMove(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function toneLabel(tone: MarketNarrativeTheme["marketTone"]): string {
  if (tone === "positive") return "Constructive";
  if (tone === "negative") return "Adverse";
  return "Mixed";
}

function leadAsset(theme: MarketNarrativeTheme) {
  return [...theme.assets]
    .filter((asset) => asset.changePercent !== null)
    .sort((a, b) => Math.abs(b.changePercent ?? 0) - Math.abs(a.changePercent ?? 0))[0] ?? null;
}

function moveTone(value: number | null | undefined): InkTone {
  if (value === null || value === undefined || !Number.isFinite(value) || value === 0) return "quiet";
  return value > 0 ? "up" : "down";
}

export function MarketNarrativePulse({ pulse }: { pulse: MarketNarrativePulseData }) {
  return (
    <section className="market-panel narrative-panel ink-panel" aria-label="Market narratives">
      <style>{`
        .narrative-panel { overflow:hidden; }
        .narrative-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
        .narrative-header-copy { max-width:680px; }
        .narrative-kicker { display:block; margin-bottom:8px; color:var(--on-ink-muted); font-size:.52rem; font-weight:700; letter-spacing:.14em; text-transform:uppercase; }
        .narrative-header h2 { font-size:1.05rem; letter-spacing:.04em; color:var(--on-ink); }
        .narrative-header p { max-width:610px; margin-top:8px; font-size:.71rem; line-height:1.55; color:var(--on-ink-muted); }
        .narrative-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:20px; }
        .narrative-card { --theme-accent:var(--on-ink-muted); position:relative; min-width:0; overflow:hidden; padding:18px; }
        .narrative-card-top { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .narrative-rank { margin-right:auto; color:var(--on-ink-muted); font-size:.56rem; font-weight:700; letter-spacing:.12em; }
        .narrative-title { margin:15px 0 0; color:var(--on-ink); font-size:1.02rem; line-height:1.2; letter-spacing:-.01em; }
        .narrative-summary { min-height:42px; margin:8px 0 0; color:var(--on-ink-muted); font-size:.69rem; line-height:1.55; }
        .narrative-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:14px; }
        .narrative-metric { min-width:0; padding:9px 10px; }
        .narrative-metric strong { display:block; overflow:hidden; color:var(--on-ink); font-size:.79rem; font-variant-numeric:tabular-nums; line-height:1.1; text-overflow:ellipsis; white-space:nowrap; }
        .narrative-metric span { display:block; margin-top:5px; overflow:hidden; color:var(--on-ink-quiet); font-size:.45rem; letter-spacing:.06em; line-height:1.2; text-overflow:ellipsis; text-transform:uppercase; white-space:nowrap; }
        .narrative-assets { display:flex; align-items:center; flex-wrap:wrap; gap:6px; margin-top:12px; }
        .narrative-assets-label { margin-right:2px; color:var(--on-ink-quiet); font-size:.45rem; letter-spacing:.07em; text-transform:uppercase; }
        .narrative-headline { position:relative; display:block; min-height:67px; margin-top:14px; padding:11px 34px 11px 12px; color:var(--on-ink); font-size:.62rem; line-height:1.5; text-decoration:none; }
        .narrative-headline[href]::after { content:"↗"; position:absolute; top:50%; right:12px; color:var(--on-ink-accent); font-size:.78rem; transform:translateY(-50%); }
        .narrative-headline:hover { filter:brightness(1.08); }
        .narrative-headline-label { display:block; margin-bottom:5px; color:var(--on-ink-muted); font-size:.45rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; }
        .narrative-headline.empty { color:var(--on-ink-quiet); }
        .narrative-footer { display:flex; justify-content:space-between; gap:14px; margin-top:13px; color:var(--on-ink-quiet); font-size:.5rem; line-height:1.45; }
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
        <span className={`${inkChipClass(pulse.status === "live" ? "up" : pulse.status === "partial" ? "amber" : "quiet")}`}>
          {pulse.status === "live" ? "Live" : pulse.status}
        </span>
      </div>

      {pulse.themes.length > 0 ? (
        <div className="narrative-grid">
          {pulse.themes.slice(0, 4).map((theme, index) => {
            const lead = leadAsset(theme);
            const cardTone = inkToneFromSemantic(theme.marketTone === "mixed" ? "mixed" : theme.marketTone);
            const leadMove = moveTone(lead?.changePercent);
            return (
              <article key={theme.id} className={`narrative-card ${inkBoxClass(cardTone)}`}>
                <div className="narrative-card-top">
                  <span className="narrative-rank">{String(index + 1).padStart(2, "0")}</span>
                  <span className={inkChipClass(heatTone(theme.heat))}>{heatLabel(theme.heat)}</span>
                  <span className={inkChipClass(cardTone)}>{toneLabel(theme.marketTone)}</span>
                </div>
                <h3 className="narrative-title">{theme.label}</h3>
                <p className="narrative-summary">{theme.summary}</p>
                <div className="narrative-metrics">
                  <div className={`narrative-metric ${inkBoxClass("quiet")}`} title="Last-hour theme mentions ÷ trailing hourly baseline ((24h − last hour) / 23, floor 0.5)">
                    <strong>{theme.velocity.toFixed(1)}×</strong>
                    <span>Attention vs baseline</span>
                  </div>
                  <div className={`narrative-metric ${inkBoxClass("quiet")}`}>
                    <strong>{theme.uniqueAuthorsLastHour}</strong>
                    <span>Unique voices</span>
                  </div>
                  <div className={`narrative-metric ${inkBoxClass(leadMove)}`}>
                    <strong>{lead ? formatMove(lead.changePercent) : "—"}</strong>
                    <span>{lead?.ticker ?? "Largest move"}</span>
                  </div>
                </div>
                <div className="narrative-assets" aria-label={`${theme.label} linked assets`}>
                  <span className="narrative-assets-label">Linked markets</span>
                  {theme.assets.map((asset) => {
                    const assetTone = moveTone(asset.changePercent);
                    return (
                      <span key={asset.ticker} className={inkChipClass(assetTone)} title={asset.label}>
                        {asset.ticker} {formatMove(asset.changePercent)}
                      </span>
                    );
                  })}
                </div>
                {theme.headline?.url ? (
                  <a className={`narrative-headline ${inkBoxClass("quiet")}`} href={theme.headline.url} target="_blank" rel="noreferrer">
                    <span className="narrative-headline-label">Driving headline</span>
                    {theme.headline.title}
                  </a>
                ) : (
                  <div className={`narrative-headline empty ${inkBoxClass("quiet")}`}>
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
        <span>Attention vs baseline = last-hour mentions ÷ trailing hourly rate. Tone tags reflect session reaction.</span>
      </div>
    </section>
  );
}

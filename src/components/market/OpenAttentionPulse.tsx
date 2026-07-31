import type {
  AttentionSignal,
  OpenAttentionPulse as OpenAttentionPulseData,
} from "@/lib/market/open-attention";

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function signalLabel(signal: AttentionSignal): string {
  if (signal === "attention-leading") return "Attention leading";
  if (signal === "price-confirming") return "Price confirming";
  if (signal === "cooling") return "Cooling";
  return "Steady";
}

export function OpenAttentionPulse({ pulse }: { pulse: OpenAttentionPulseData }) {
  if (pulse.status === "unavailable" || pulse.items.length === 0) {
    return (
      <section className="market-panel attention-panel" aria-label="Open attention pulse">
        <div className="market-panel-header attention-header">
          <div>
            <h2>Open Attention</h2>
            <p>Public market conversation is temporarily unavailable.</p>
          </div>
          <span className="attention-status unavailable">OFFLINE</span>
        </div>
      </section>
    );
  }

  return (
    <section className="market-panel attention-panel" aria-label="Open attention pulse">
      <style>{`
        .attention-panel { --attention-blue:#2563eb; --attention-purple:#7c3aed; overflow:hidden; }
        .attention-header { display:flex; align-items:flex-start; justify-content:space-between; gap:18px; }
        .attention-header-copy { max-width:650px; }
        .attention-status { flex:0 0 auto; padding:5px 7px; border:1px solid color-mix(in srgb,var(--attention-blue) 32%,transparent); border-radius:999px; color:var(--attention-blue); font-size:.5rem; letter-spacing:.09em; line-height:1; }
        .attention-status.partial { color:var(--amber); border-color:color-mix(in srgb,var(--amber) 32%,transparent); }
        .attention-status.unavailable { color:var(--market-muted); border-color:var(--market-border); }
        .attention-source-note { margin-top:9px!important; color:var(--market-muted); }
        .attention-list { display:grid; gap:8px; margin-top:17px; }
        .attention-row { position:relative; display:grid; grid-template-columns:minmax(240px,1fr) 74px 64px 70px 112px; gap:13px; align-items:center; min-height:76px; padding:13px 14px; overflow:hidden; border:1px solid var(--market-border); border-radius:9px; background:color-mix(in srgb,var(--market-card) 84%,white); }
        .attention-row::before { content:""; position:absolute; inset:0 auto 0 0; width:3px; background:var(--attention-blue); opacity:.8; }
        .attention-row.signal-attention-leading::before { background:var(--attention-purple); }
        .attention-row.signal-price-confirming::before { background:var(--market-green); }
        .attention-row.signal-cooling::before { background:var(--market-muted); }
        .attention-identity { min-width:0; }
        .attention-title-line { display:flex; align-items:center; gap:8px; }
        .attention-ticker { color:var(--market-text); font-size:.75rem; letter-spacing:.05em; }
        .attention-name { overflow:hidden; color:var(--market-muted); font-size:.58rem; text-overflow:ellipsis; white-space:nowrap; }
        .attention-summary { margin:7px 0 0; overflow:hidden; color:var(--market-muted); font-size:.58rem; line-height:1.42; text-overflow:ellipsis; white-space:nowrap; }
        .attention-submeta { margin-top:5px; color:color-mix(in srgb,var(--market-muted) 78%,transparent); font-size:.49rem; letter-spacing:.02em; }
        .attention-metric { display:flex; flex-direction:column; gap:4px; min-width:0; }
        .attention-metric-label { color:var(--market-muted); font-size:.48rem; letter-spacing:.08em; text-transform:uppercase; }
        .attention-metric strong { color:var(--market-text); font-size:.78rem; font-variant-numeric:tabular-nums; }
        .attention-metric strong.positive { color:var(--market-green); }
        .attention-metric strong.negative { color:var(--market-red); }
        .attention-badge { justify-self:end; padding:6px 7px; border-radius:5px; background:color-mix(in srgb,var(--attention-blue) 12%,transparent); color:var(--attention-blue); font-size:.5rem; line-height:1.2; text-align:center; }
        .attention-badge.attention-leading { color:var(--attention-purple); background:color-mix(in srgb,var(--attention-purple) 12%,transparent); }
        .attention-badge.price-confirming { color:var(--market-green); background:color-mix(in srgb,var(--market-green) 12%,transparent); }
        .attention-badge.cooling { color:var(--market-muted); background:color-mix(in srgb,var(--market-muted) 10%,transparent); }
        .attention-footer { display:flex; justify-content:space-between; gap:14px; margin-top:11px; color:var(--market-muted); font-size:.5rem; line-height:1.45; }
        @media (max-width:700px) {
          .attention-row { grid-template-columns:minmax(0,1fr) 60px 64px; gap:10px; }
          .attention-price { display:none; }
          .attention-badge { grid-column:1/-1; justify-self:start; margin-top:-2px; }
          .attention-summary { white-space:normal; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
          .attention-footer { flex-direction:column; gap:4px; }
        }
      `}</style>

      <div className="market-panel-header attention-header">
        <div className="attention-header-copy">
          <h2>Open Attention</h2>
          <p>Where public conversation is changing faster than its recent baseline.</p>
          <p className="attention-source-note">Bluesky public data · no paid API · aggregate signals only</p>
        </div>
        <span className={`attention-status ${pulse.status}`}>
          {pulse.status === "partial" ? "PARTIAL" : "LIVE"}
        </span>
      </div>

      <div className="attention-list">
        {pulse.items.slice(0, 6).map((item) => (
          <article key={item.ticker} className={`attention-row signal-${item.signal}`}>
            <div className="attention-identity">
              <div className="attention-title-line">
                <strong className="attention-ticker">{item.ticker}</strong>
                <span className="attention-name">{item.label}</span>
              </div>
              <p className="attention-summary">{item.summary}</p>
              <div className="attention-submeta">{item.uniqueAuthorsLastHour} authors · {item.confidence} confidence</div>
            </div>
            <div className="attention-metric">
              <span className="attention-metric-label">Velocity</span>
              <strong>{item.velocity.toFixed(1)}×</strong>
            </div>
            <div className="attention-metric">
              <span className="attention-metric-label">1 hour</span>
              <strong>{item.mentionsLastHour}</strong>
            </div>
            <div className="attention-metric attention-price">
              <span className="attention-metric-label">Price</span>
              <strong className={(item.priceChangePercent ?? 0) > 0 ? "positive" : (item.priceChangePercent ?? 0) < 0 ? "negative" : ""}>
                {formatPercent(item.priceChangePercent)}
              </strong>
            </div>
            <span className={`attention-badge ${item.signal}`}>{signalLabel(item.signal)}</span>
          </article>
        ))}
      </div>

      <div className="attention-footer">
        <span>{pulse.methodology}</span>
        <span>Signal, not sentiment.</span>
      </div>
    </section>
  );
}

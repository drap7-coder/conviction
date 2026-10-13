import Link from "next/link";
import type { BriefName } from "@/lib/watchlist/daily-brief";
import type { BriefCoverage } from "@/lib/watchlist/brief-coverage";

/** Charts describe verified briefing coverage, never price performance or portfolio weights. */
export function BriefIntelligence({ names, coverage }: { names: BriefName[]; coverage: BriefCoverage }) {
  const checked = new Set(coverage.checked);
  const failed = new Set(coverage.failed);
  const end = Math.max(coverage.fetchedAt ?? 0, ...coverage.stories.map(({ event }) => Date.parse(event.date)));
  const start = end - 48 * 3_600_000;
  return <div className="brief-intelligence">
    <section className="brief-scope" aria-labelledby="brief-scope-title">
      <div className="brief-panel-label"><h3 id="brief-scope-title">01 / Coverage map</h3><span>{checked.size} / {names.length} checked</span></div>
      <div className="brief-coverage-bar" role="img" aria-label={`${checked.size} of ${names.length} companies checked; ${failed.size} unavailable. Remaining companies not checked.`}>
        <span style={{ width: `${names.length ? checked.size / names.length * 100 : 0}%` }} />
        <span className="is-unavailable" style={{ width: `${names.length ? failed.size / names.length * 100 : 0}%` }} />
      </div>
      <div className="brief-company-map">{names.map(({ ticker, held }) => <Link key={ticker} href={`/companies/${encodeURIComponent(ticker)}`} className={failed.has(ticker) ? "is-unavailable" : checked.has(ticker) ? "is-checked" : "is-pending"}>
        <strong>{ticker}</strong><span>{held ? "Owned" : "Watched"} · {failed.has(ticker) ? "Unavailable" : checked.has(ticker) ? "Checked" : "Not checked"}</span>
      </Link>)}</div>
      <p>Holdings first. Coverage status, not a buy or sell signal.</p>
    </section>
    <section className="brief-timeline" aria-labelledby="brief-timeline-title">
      <div className="brief-panel-label"><h3 id="brief-timeline-title">02 / Report timeline</h3><span>{coverage.stories.length} selected</span></div>
      {coverage.stories.length ? <>
        <svg viewBox="0 0 520 180" role="img" aria-label="Selected reports positioned by publication time within the 48 hours ending at the latest report or coverage fetch.">
          {[40, 150, 260, 370, 480].map((x) => <line key={x} x1={x} x2={x} y1="12" y2="155" className="brief-chart-grid" />)}
          {coverage.stories.map(({ ticker, event }, i) => {
            const x = 40 + Math.max(0, Math.min(1, (Date.parse(event.date) - start) / (end - start))) * 440;
            const y = 32 + i * 48;
            return <g key={ticker}><title>{ticker}: {event.title} — {event.date}</title><line x1="40" x2="480" y1={y} y2={y} className="brief-chart-track" /><circle cx={x} cy={y} r="5" /><text x="40" y={y + 19}>{ticker}</text></g>;
          })}
          <text x="40" y="176">−48h</text><text x="244" y="176">−24h</text><text x="445" y="176">Latest</text>
        </svg>
        <p>Publication times of the reports below. Up to three selected stories; not total news volume.</p>
      </> : <div className="brief-chart-empty"><span>—</span><p>No verified reports to plot.<br />Missing coverage is not a quiet-market signal.</p></div>}
    </section>
  </div>;
}

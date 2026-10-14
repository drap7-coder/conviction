import Link from "next/link";
import type { BriefName } from "@/lib/watchlist/daily-brief";
import type { BriefCoverage } from "@/lib/watchlist/brief-coverage";

const RING = 54;
const STROKE = 10;
const CIRC = 2 * Math.PI * RING;

/** Charts describe verified briefing coverage, never price performance or portfolio weights. */
export function BriefIntelligence({
  names,
  coverage,
  scaffold = false,
}: {
  names: BriefName[];
  coverage: BriefCoverage;
  /** Honest empty frames when no companies are in scope yet. */
  scaffold?: boolean;
}) {
  const checked = new Set(coverage.checked);
  const failed = new Set(coverage.failed);
  const pending = Math.max(0, names.length - checked.size - failed.size);
  const heldCount = names.filter((name) => name.held).length;
  const watchedCount = Math.max(0, names.length - heldCount);
  const end = Math.max(
    coverage.fetchedAt ?? 0,
    ...coverage.stories.map(({ event }) => Date.parse(event.date)),
  );
  const start = end - 48 * 3_600_000;
  const total = Math.max(names.length, 1);
  const checkedLen = names.length ? (checked.size / total) * CIRC : 0;
  const failedLen = names.length ? (failed.size / total) * CIRC : 0;
  const pendingLen = names.length ? (pending / total) * CIRC : 0;
  const heldPct = names.length ? (heldCount / names.length) * 100 : 0;
  const watchedPct = names.length ? (watchedCount / names.length) * 100 : 0;

  const timelinePoints = coverage.stories.map(({ ticker, event }, i) => {
    const x =
      40 +
      Math.max(0, Math.min(1, (Date.parse(event.date) - start) / (end - start || 1))) *
        440;
    const y = 40 + i * 42;
    return { ticker, event, x, y };
  });
  const pathD =
    timelinePoints.length > 1
      ? timelinePoints
          .map((point, i) => `${i === 0 ? "M" : "L"} ${point.x} ${point.y}`)
          .join(" ")
      : "";

  return (
    <div className={`brief-intelligence${scaffold ? " is-scaffold" : ""}`}>
      <section className="brief-scope" aria-labelledby="brief-scope-title">
        <div className="brief-panel-label">
          <h3 id="brief-scope-title">01 / Coverage map</h3>
          <span>
            {checked.size} / {names.length} checked
          </span>
        </div>
        <div className="brief-scope-visual">
          <svg
            className="brief-coverage-ring"
            viewBox="0 0 140 140"
            role="img"
            aria-label={
              scaffold
                ? "Coverage ring idle. Add companies to begin checking reports."
                : `${checked.size} of ${names.length} companies checked; ${failed.size} unavailable; ${pending} not checked.`
            }
          >
            <circle className="brief-ring-track" cx="70" cy="70" r={RING} fill="none" strokeWidth={STROKE} />
            {names.length > 0 ? (
              <>
                <circle
                  className="brief-ring-checked"
                  cx="70"
                  cy="70"
                  r={RING}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeDasharray={`${checkedLen} ${CIRC}`}
                  strokeDashoffset={0}
                  transform="rotate(-90 70 70)"
                />
                <circle
                  className="brief-ring-failed"
                  cx="70"
                  cy="70"
                  r={RING}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeDasharray={`${failedLen} ${CIRC}`}
                  strokeDashoffset={-checkedLen}
                  transform="rotate(-90 70 70)"
                />
                <circle
                  className="brief-ring-pending"
                  cx="70"
                  cy="70"
                  r={RING}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeDasharray={`${pendingLen} ${CIRC}`}
                  strokeDashoffset={-(checkedLen + failedLen)}
                  transform="rotate(-90 70 70)"
                />
              </>
            ) : null}
            <text className="brief-ring-value" x="70" y="66" textAnchor="middle">
              {checked.size}
            </text>
            <text className="brief-ring-caption" x="70" y="86" textAnchor="middle">
              checked
            </text>
          </svg>
          <div className="brief-scope-side">
            <ul className="brief-coverage-legend">
              <li>
                <span className="is-checked" aria-hidden="true" />
                <span className="brief-coverage-legend-label">Checked</span>
                <span className="brief-coverage-legend-count tnum">{checked.size}</span>
              </li>
              <li>
                <span className="is-unavailable" aria-hidden="true" />
                <span className="brief-coverage-legend-label">Unavailable</span>
                <span className="brief-coverage-legend-count tnum">{failed.size}</span>
              </li>
              <li>
                <span className="is-pending" aria-hidden="true" />
                <span className="brief-coverage-legend-label">Not checked</span>
                <span className="brief-coverage-legend-count tnum">{pending}</span>
              </li>
            </ul>
            <div
              className="brief-book-mix"
              role="img"
              aria-label={
                names.length
                  ? `Book mix: ${heldCount} owned, ${watchedCount} watched.`
                  : "Book mix idle. No companies in scope."
              }
            >
              <div className="brief-book-mix-label">
                <span>Owned</span>
                <span>Watched</span>
              </div>
              <div className="brief-book-mix-bar">
                <span className="is-held" style={{ width: `${heldPct}%` }} />
                <span className="is-watched" style={{ width: `${watchedPct}%` }} />
              </div>
              <div className="brief-book-mix-counts tnum">
                <span>{heldCount}</span>
                <span>{watchedCount}</span>
              </div>
            </div>
          </div>
        </div>
        {names.length > 0 ? (
          <div className="brief-company-map">
            {names.map(({ ticker, held }) => (
              <Link
                key={ticker}
                href={`/companies/${encodeURIComponent(ticker)}`}
                className={
                  failed.has(ticker)
                    ? "is-unavailable"
                    : checked.has(ticker)
                      ? "is-checked"
                      : "is-pending"
                }
              >
                <strong>{ticker}</strong>
                <span>
                  {held ? "Owned" : "Watched"} ·{" "}
                  {failed.has(ticker)
                    ? "Unavailable"
                    : checked.has(ticker)
                      ? "Checked"
                      : "Not checked"}
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="brief-company-map is-empty" aria-hidden="true">
            {["—", "—", "—", "—"].map((slot, i) => (
              <div key={i} className="is-pending">
                <strong>{slot}</strong>
                <span>Awaiting ticker</span>
              </div>
            ))}
          </div>
        )}
        <p>
          {scaffold
            ? "Graphs stay honest: zeros until companies are in scope."
            : "Holdings first. Coverage status, not a buy or sell signal."}
        </p>
      </section>

      <section className="brief-timeline" aria-labelledby="brief-timeline-title">
        <div className="brief-panel-label">
          <h3 id="brief-timeline-title">02 / Report timeline</h3>
          <span>{coverage.stories.length} selected</span>
        </div>
        {coverage.stories.length ? (
          <>
            <svg
              className="brief-timeline-chart"
              viewBox="0 0 520 200"
              role="img"
              aria-label="Selected reports positioned by publication time within the 48 hours ending at the latest report or coverage fetch."
            >
              {[40, 150, 260, 370, 480].map((x) => (
                <line key={x} x1={x} x2={x} y1="18" y2="158" className="brief-chart-grid" />
              ))}
              <line x1="40" x2="480" y1="158" y2="158" className="brief-chart-baseline" />
              {pathD ? <path d={pathD} className="brief-chart-path" fill="none" /> : null}
              {timelinePoints.map(({ ticker, event, x, y }) => (
                <g key={ticker} className="brief-timeline-row">
                  <title>
                    {ticker}: {event.title} — {event.date}
                  </title>
                  <line x1="40" x2="480" y1={y} y2={y} className="brief-chart-track" />
                  <line x1={x} x2={x} y1={y} y2="158" className="brief-chart-drop" />
                  <circle cx={x} cy={y} r="7" className="brief-chart-dot-halo" />
                  <circle cx={x} cy={y} r="4.5" className="brief-chart-dot" />
                  <text x="40" y={y - 10}>
                    {ticker}
                  </text>
                </g>
              ))}
              <text x="40" y="184">
                −48h
              </text>
              <text x="244" y="184">
                −24h
              </text>
              <text x="445" y="184">
                Latest
              </text>
            </svg>
            <p>Publication times of the reports below. Up to three selected stories; not total news volume.</p>
          </>
        ) : (
          <div className="brief-timeline-idle">
            <svg
              className="brief-timeline-chart"
              viewBox="0 0 520 160"
              role="img"
              aria-label="Empty 48-hour report timeline. No verified reports plotted."
            >
              {[40, 150, 260, 370, 480].map((x) => (
                <line key={x} x1={x} x2={x} y1="24" y2="110" className="brief-chart-grid" />
              ))}
              <line x1="40" x2="480" y1="110" y2="110" className="brief-chart-baseline" />
              <text x="40" y="136">
                −48h
              </text>
              <text x="244" y="136">
                −24h
              </text>
              <text x="445" y="136">
                Latest
              </text>
              <text x="260" y="70" textAnchor="middle" className="brief-timeline-idle-label">
                {scaffold ? "No companies in scope" : "No verified reports to plot"}
              </text>
            </svg>
            <p>Missing coverage is not a quiet-market signal.</p>
          </div>
        )}
      </section>
    </div>
  );
}

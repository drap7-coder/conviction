import Link from "next/link";
import type { BriefName } from "@/lib/watchlist/daily-brief";
import type { BriefCoverage } from "@/lib/watchlist/brief-coverage";

const RING = 54;
const STROKE = 10;
const CIRC = 2 * Math.PI * RING;
const TICK_COUNT = 36;

function radarTicks() {
  return Array.from({ length: TICK_COUNT }, (_, i) => {
    const angle = (i / TICK_COUNT) * Math.PI * 2 - Math.PI / 2;
    const outer = 69;
    const inner = i % 3 === 0 ? 61 : 64.5;
    return {
      key: i,
      x1: 70 + Math.cos(angle) * inner,
      y1: 70 + Math.sin(angle) * inner,
      x2: 70 + Math.cos(angle) * outer,
      y2: 70 + Math.sin(angle) * outer,
      major: i % 3 === 0,
    };
  });
}

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
  const batchKey = `${checked.size}-${failed.size}-${coverage.fetchedAt ?? 0}`;

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
  const areaD =
    timelinePoints.length > 1
      ? `${pathD} L ${timelinePoints[timelinePoints.length - 1].x} 158 L ${timelinePoints[0].x} 158 Z`
      : timelinePoints.length === 1
        ? `M ${timelinePoints[0].x} ${timelinePoints[0].y} L ${timelinePoints[0].x} 158 Z`
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
            <defs>
              <linearGradient id="brief-radar-sweep-fill" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(95, 208, 165, 0)" />
                <stop offset="55%" stopColor="rgba(95, 208, 165, 0.12)" />
                <stop offset="100%" stopColor="rgba(95, 208, 165, 0.55)" />
              </linearGradient>
            </defs>
            <circle className="brief-ring-track" cx="70" cy="70" r={RING} fill="none" strokeWidth={STROKE} />
            <g className="brief-radar-ticks" key={batchKey}>
              {radarTicks().map((tick) => (
                <line
                  key={tick.key}
                  className={tick.major ? "is-major" : undefined}
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                />
              ))}
            </g>
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
            <g className="brief-radar-sweep" aria-hidden="true">
              <path
                d="M70 70 L70 12 A58 58 0 0 1 122 42 Z"
                fill="url(#brief-radar-sweep-fill)"
              />
              <line x1="70" y1="70" x2="70" y2="12" className="brief-radar-beam" />
            </g>
            <circle className="brief-radar-hub" cx="70" cy="70" r="3.5" />
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
              <defs>
                <linearGradient id="brief-timeline-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(140, 224, 219, 0.28)" />
                  <stop offset="100%" stopColor="rgba(140, 224, 219, 0)" />
                </linearGradient>
              </defs>
              {[40, 95, 150, 205, 260, 315, 370, 425, 480].map((x) => (
                <line key={`v-${x}`} x1={x} x2={x} y1="18" y2="158" className="brief-chart-grid" />
              ))}
              {[40, 82, 124].map((y) => (
                <line key={`h-${y}`} x1="40" x2="480" y1={y} y2={y} className="brief-chart-grid is-horiz" />
              ))}
              <line x1="40" x2="480" y1="158" y2="158" className="brief-chart-baseline" />
              {areaD ? <path d={areaD} className="brief-chart-area" /> : null}
              {pathD ? <path d={pathD} className="brief-chart-path" fill="none" /> : null}
              {timelinePoints.map(({ ticker, event, x, y }) => {
                const hoursFromLatest = Math.max(
                  0,
                  Math.round(48 - ((x - 40) / 440) * 48),
                );
                return (
                <g key={ticker} className="brief-timeline-row" tabIndex={0}>
                  <title>
                    {ticker}: {event.title} — {event.date}
                  </title>
                  <rect
                    className="brief-chart-hit"
                    x="36"
                    y={y - 18}
                    width="448"
                    height="36"
                  />
                  <line x1="40" x2="480" y1={y} y2={y} className="brief-chart-track" />
                  <line x1={x} x2={x} y1={y} y2="158" className="brief-chart-drop" />
                  <g className="brief-chart-reticle" aria-hidden="true">
                    <path d={`M${x - 9} ${y - 4} V${y - 9} H${x - 4}`} />
                    <path d={`M${x + 9} ${y - 4} V${y - 9} H${x + 4}`} />
                    <path d={`M${x - 9} ${y + 4} V${y + 9} H${x - 4}`} />
                    <path d={`M${x + 9} ${y + 4} V${y + 9} H${x + 4}`} />
                  </g>
                  <g className="brief-chart-crosshair" aria-hidden="true">
                    <line className="is-v" x1={x} x2={x} y1="18" y2="158" />
                    <line className="is-h" x1="40" x2="480" y1={y} y2={y} />
                    <path d={`M${x - 11} ${y - 5} V${y - 11} H${x - 5}`} />
                    <path d={`M${x + 11} ${y - 5} V${y - 11} H${x + 5}`} />
                    <path d={`M${x - 11} ${y + 5} V${y + 11} H${x - 5}`} />
                    <path d={`M${x + 11} ${y + 5} V${y + 11} H${x + 5}`} />
                    <text className="brief-chart-coord" x={Math.min(x + 14, 430)} y={y - 12}>
                      {ticker} · −{hoursFromLatest}h
                    </text>
                  </g>
                  <circle cx={x} cy={y} r="7" className="brief-chart-dot-halo" />
                  <circle cx={x} cy={y} r="4.5" className="brief-chart-dot" />
                  <text x="40" y={y - 10}>
                    {ticker}
                  </text>
                </g>
              );
              })}
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
              {[40, 95, 150, 205, 260, 315, 370, 425, 480].map((x) => (
                <line key={`v-${x}`} x1={x} x2={x} y1="24" y2="110" className="brief-chart-grid" />
              ))}
              {[40, 75].map((y) => (
                <line key={`h-${y}`} x1="40" x2="480" y1={y} y2={y} className="brief-chart-grid is-horiz" />
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

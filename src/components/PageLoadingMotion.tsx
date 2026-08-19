interface PageLoadingMotionProps {
  label: string;
  compact?: boolean;
  /** Hide the h3/p text so the loader is motion-only (skeleton style). */
  showLabel?: boolean;
  showSubtitle?: boolean;
  /** Slow down shimmer/build animations to match LinkedIn-style pacing. */
  speed?: "normal" | "slow";
}

export function PageLoadingMotion({
  label,
  compact = false,
  showLabel = true,
  showSubtitle = true,
  speed = "normal",
}: PageLoadingMotionProps) {
  return (
    <div
      className={`rising-build page-loading-motion${compact ? " compact" : ""}${speed === "slow" ? " slow" : ""}`}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="rising-build-header">
        <div>
          {showLabel ? <h3>{label}</h3> : null}
          {showSubtitle ? <p>Reading the latest market signals…</p> : null}
        </div>
        <div className="rising-build-meter" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
      </div>
      <div className="rising-build-grid" aria-hidden="true">
        {Array.from({ length: compact ? 2 : 3 }, (_, index) => (
          <div className="rising-build-card" key={index}>
            <span className="rising-scan-line" />
            <div className="rising-build-row">
              <span className="rising-build-chip" />
              <span className="rising-build-title" />
              <span className="rising-build-score" />
            </div>
            <div className="rising-build-facts"><span /><span /><span /></div>
            <span className="rising-build-copy" />
            <span className="rising-build-copy short" />
          </div>
        ))}
      </div>
    </div>
  );
}

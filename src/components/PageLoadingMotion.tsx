interface PageLoadingMotionProps {
  label: string;
  compact?: boolean;
}

export function PageLoadingMotion({ label, compact = false }: PageLoadingMotionProps) {
  return (
    <div className={`rising-build page-loading-motion${compact ? " compact" : ""}`} role="status" aria-live="polite" aria-label={label}>
      <div className="rising-build-header">
        <div>
          <h3>{label}</h3>
          <p>Reading the latest market signals…</p>
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

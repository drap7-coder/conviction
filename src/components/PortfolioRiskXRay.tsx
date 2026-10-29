import type { PortfolioRiskXRayResult } from "@/lib/portfolio/risk-xray";

function strength(score: number): string {
  if (score >= 55) return "Dominant";
  if (score >= 30) return "Meaningful";
  if (score >= 12) return "Present";
  return "Limited";
}

export function PortfolioRiskXRay({ result }: { result: PortfolioRiskXRayResult }) {
  return (
    <section className="pf-risk-xray surface-shell" aria-labelledby="pf-risk-xray-title">
      <header className="pf-risk-xray-head">
        <div>
          <span className="pf-section-eyebrow">Risk X-Ray</span>
          <h2 id="pf-risk-xray-title">{result.headline}</h2>
          <p>{result.detail}</p>
        </div>
        <span className="pf-risk-xray-coverage" title="Share of portfolio weight with a recognized exposure">{result.coverage}% classified</span>
      </header>
      <div className="pf-risk-xray-grid">
        {result.factors.map((factor) => (
          <article key={factor.id} className={`pf-risk-factor is-${factor.id}`}>
            <div className="pf-risk-factor-top">
              <div><span>{factor.label}</span><strong>{strength(factor.score)}</strong></div>
              <b className="tnum">{factor.score}%</b>
            </div>
            <div className="pf-risk-factor-track" aria-hidden="true"><span style={{ width: `${factor.score}%` }} /></div>
            <p>{factor.interpretation}</p>
            <div className="pf-risk-factor-drivers" aria-label={`${factor.label} drivers`}>
              {factor.drivers.length > 0 ? factor.drivers.map((driver) => (
                <span key={driver.ticker}>{driver.ticker} <b className="tnum">{driver.weight.toFixed(0)}%</b></span>
              )) : <span>No material drivers</span>}
            </div>
          </article>
        ))}
      </div>
      <p className="pf-risk-xray-note">Directional lens based on holding weights and classified exposures—not a forecast, stress test, or risk score.</p>
    </section>
  );
}

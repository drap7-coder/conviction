import Link from "next/link";

/**
 * Evergreen Pulse explanation — collapsible footer below the data boards.
 * Stays in the initial HTML for SEO without interrupting the scan line.
 */
export function PulseAbout() {
  return (
    <details className="pulse-about pulse-about--footer">
      <summary className="pulse-about-summary">
        <span className="pulse-about-summary-label">About IQBulls Pulse</span>
        <span className="pulse-about-summary-hint" aria-hidden="true">
          Overview & disclaimer
        </span>
      </summary>
      <div className="pulse-about-panel">
        <h2 id="pulse-about-heading" className="sr-only">
          About IQBulls Pulse
        </h2>
        <div className="pulse-about-copy">
          <p>
            IQBulls Pulse is the full public market tape — major stock indexes,
            U.S. sectors, commodities, cryptocurrency, and international country funds
            on one slicer. Home keeps a shorter macro glance; personal holdings and
            the daily brief stay on your{" "}
            <Link href="/portfolio">portfolio and watchlist</Link>, separate from
            this tape. Pair either surface with the{" "}
            <Link href="/crowd">campus Crowd</Link> competition when you want school
            picks.
          </p>
          <p>
            Premarket and after-hours labels mark extended-session prints when they
            are available. Quotes can update through the session and may reflect
            exchange or vendor delays — treat them as a decision aid, not a
            brokerage tape. The VIX gauge summarizes expected near-term equity
            volatility; the 10-year Treasury yield summarizes the long bond’s
            market-implied rate. Pair Pulse with{" "}
            <Link href="/news">market news</Link> when you want the story behind a
            move.
          </p>
          <p>
            Nothing on Pulse is investment advice. Returns, rankings, and headlines
            are informational only. You remain responsible for your own decisions.
          </p>
        </div>
      </div>
    </details>
  );
}

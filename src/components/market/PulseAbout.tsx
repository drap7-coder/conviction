import Link from "next/link";

/**
 * Server-rendered evergreen explanation for Pulse.
 * Kept below the dashboard so SEO copy is in the initial HTML without
 * pushing the boards below the fold on a normal viewport.
 */
export function PulseAbout() {
  return (
    <section className="pulse-about" aria-labelledby="pulse-about-heading">
      <h2 id="pulse-about-heading">About IQBulls Pulse</h2>
      <div className="pulse-about-copy">
        <p>
          IQBulls Pulse is a free market overview that pulls major stock indexes,
          U.S. sectors, commodities, cryptocurrency, and international country funds
          into one place. Use it to see what is moving before you dig into a single
          ticker, your{" "}
          <Link href="/portfolio">portfolio and watchlist</Link>, or the{" "}
          <Link href="/crowd">campus Crowd</Link> competition.
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
    </section>
  );
}

"use client";

import Link from "next/link";
import { BriefIntelligence } from "@/components/BriefIntelligence";
import { BriefQuantOverlay } from "@/components/BriefQuantOverlay";
import { useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { briefContext, briefNames } from "@/lib/watchlist/daily-brief";
import {
  BRIEF_BATCH_SIZE,
  createBriefLoader,
  type BriefCoverage,
  type BriefNews,
} from "@/lib/watchlist/brief-coverage";
import { trackProductEvent } from "@/lib/product-analytics";

type BriefView = "narrative" | "quant";

const newsLoader = createBriefLoader((ticker, signal) =>
  fetchJsonWithTimeout<BriefNews>(
    `/api/evidence/news?ticker=${encodeURIComponent(ticker)}`,
    10000,
    signal,
  ),
);

const EMPTY_COVERAGE: BriefCoverage = {
  stories: [],
  checked: [],
  failed: [],
  fetchedAt: null,
};

function coverageTime(value: number) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

export function PersonalDailyBrief({
  tickers,
  held,
  loading,
  portfolioError = false,
  watchlistError = false,
  onRetryWatchlist,
}: {
  tickers: string[];
  held: string[];
  portfolioError?: boolean;
  loading: boolean;
  watchlistError?: boolean;
  onRetryWatchlist?: () => void;
}) {
  const [retry, setRetry] = useState(0);
  const [coverageLimit, setCoverageLimit] = useState(BRIEF_BATCH_SIZE);
  const [view, setView] = useState<BriefView>("narrative");
  const [result, setResult] = useState<(BriefCoverage & { key: string }) | null>(null);

  const names = briefNames(held, tickers);
  const covered = names.slice(0, coverageLimit);
  const key = JSON.stringify(covered);
  const ready = !loading;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const selected = JSON.parse(key) as ReturnType<typeof briefNames>;
    if (selected.length === 0) {
      setResult({ key, ...EMPTY_COVERAGE });
      return;
    }
    void newsLoader
      .load(selected, controller.signal)
      .then((coverage) => {
        if (controller.signal.aborted) return;
        setResult({ key, ...coverage });
        if (coverage.stories.length) trackProductEvent("daily_brief_viewed");
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setResult({
            key,
            stories: [],
            checked: [],
            failed: selected.map((name) => name.ticker),
            fetchedAt: null,
          });
        }
      });
    return () => controller.abort();
  }, [key, ready, retry]);

  const current = result?.key === key ? result : null;
  const busy = !ready || (covered.length > 0 && !current);
  const emptyScope =
    ready && names.length === 0 && !portfolioError && !watchlistError;

  function refresh() {
    if (watchlistError || portfolioError) onRetryWatchlist?.();
    newsLoader.invalidate(covered.map((name) => name.ticker));
    setResult(null);
    setRetry((n) => n + 1);
  }

  return (
    <section className="personal-brief" aria-labelledby="personal-brief-heading" aria-busy={busy}>
      <header className="personal-brief-header">
        <div>
          <span className="personal-brief-eyebrow">DAILY INTELLIGENCE / 48H WINDOW</span>
          <h2 id="personal-brief-heading">Your daily brief</h2>
          <p>Recent reporting on your holdings and watchlist.</p>
        </div>
        <div className="personal-brief-header-tools">
          {names.length > 0 ? (
            <div className="personal-brief-view" role="group" aria-label="Brief view">
              <button
                type="button"
                className={view === "narrative" ? "is-active" : undefined}
                aria-pressed={view === "narrative"}
                onClick={() => setView("narrative")}
              >
                Brief
              </button>
              <button
                type="button"
                className={view === "quant" ? "is-active" : undefined}
                aria-pressed={view === "quant"}
                onClick={() => setView("quant")}
              >
                Analytics
              </button>
            </div>
          ) : null}
          {names.length > 0 ? (
            <Link href="/manage?view=watchlist" className="personal-brief-edit">
              Edit companies →
            </Link>
          ) : null}
        </div>
      </header>

      {busy ? (
        <p className="personal-brief-loading" role="status">
          Checking recent company news…
        </p>
      ) : null}

      {emptyScope ? (
        <>
          <div className="personal-brief-empty personal-brief-cta">
            <h3>Start with a company you care about.</h3>
            <p>Your brief starts with the first name. No account required.</p>
            <Link
              href="/manage?view=watchlist"
              className="brief-link"
              onClick={() => trackProductEvent("brief_setup_started")}
            >
              Build your watchlist →
            </Link>
          </div>
          <BriefIntelligence names={[]} coverage={EMPTY_COVERAGE} scaffold />
        </>
      ) : null}

      {!busy && !emptyScope ? (
        <>
          {view === "quant" ? (
            <BriefQuantOverlay names={covered} />
          ) : (
            <>
              <div className="personal-brief-trust" role="status">
                <span>
                  Last 48 hours · {current?.checked.length ?? 0} of {names.length} names checked
                </span>
                {current?.fetchedAt != null ? (
                  <time dateTime={new Date(current.fetchedAt).toISOString()}>
                    Coverage fetched {coverageTime(current.fetchedAt)}
                  </time>
                ) : null}
              </div>
              {current?.stories.length ? (
                <div className="personal-brief-stories">
                  {current.stories.map(({ ticker, held: isHeld, event }, index) => (
                    <article key={ticker} className={index === 0 ? "is-lead" : undefined}>
                      <div className="personal-brief-meta">
                        <span className="personal-brief-index">
                          {String(index + 1).padStart(2, "0")} / Report
                        </span>
                        <span>{ticker}</span>
                        <span>{isHeld ? "You own" : "You watch"}</span>
                      </div>
                      <h3>{event.title}</h3>
                      <details>
                        <summary>Why it matters</summary>
                        {event.summary ? <p>{event.summary}</p> : null}
                        <p>{briefContext(event, ticker)}</p>
                      </details>
                      <footer>
                        <span>
                          {event.metadata?.publisher || "Source report"} ·{" "}
                          <time dateTime={event.date}>
                            {new Date(event.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </time>
                        </span>
                        <a
                          href={event.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => trackProductEvent("brief_evidence_opened")}
                        >
                          Read source ↗
                        </a>
                        <Link
                          href={`/companies/${encodeURIComponent(ticker)}`}
                          onClick={() => trackProductEvent("brief_evidence_opened")}
                        >
                          Research {ticker} →
                        </Link>
                      </footer>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="personal-brief-empty">
                  <h3>
                    {current?.checked.length
                      ? "No recent reports in the checked names."
                      : "Coverage is unavailable right now."}
                  </h3>
                  <p>
                    {current?.checked.length
                      ? "No sourced stories from the last 48 hours were returned. This does not mean nothing has changed."
                      : "We could not verify recent reporting. Your saved companies are unchanged."}
                  </p>
                </div>
              )}
              {current && names.length > 0 ? (
                <BriefIntelligence names={names} coverage={current} />
              ) : null}
              {portfolioError || watchlistError || Boolean(current?.failed.length) ? (
                <p role="status" className="personal-brief-warning">
                  {portfolioError ? "Holdings could not be loaded. " : ""}
                  {watchlistError ? "Watchlist sync is unavailable. " : ""}
                  {current?.failed.length
                    ? `News unavailable: ${current.failed.join(", ")}. `
                    : ""}
                  Coverage is incomplete.
                </p>
              ) : null}
              <div className="personal-brief-actions">
                {names.length > covered.length ? (
                  <button
                    type="button"
                    onClick={() => setCoverageLimit((n) => n + BRIEF_BATCH_SIZE)}
                  >
                    Check next {Math.min(BRIEF_BATCH_SIZE, names.length - covered.length)} names →
                  </button>
                ) : null}
                <button type="button" onClick={refresh}>
                  Refresh coverage
                </button>
              </div>
              {covered.length ? (
                <details className="personal-brief-coverage">
                  <summary>Coverage details</summary>
                  <p>Checked: {current?.checked.join(", ") || "None"}.</p>
                  <p>
                    Holdings are checked first, then watched companies, in groups of six. Only three
                    recent reports are shown. Coverage is cached for up to 15 minutes; the time above
                    is the oldest successful fetch in this brief, not a live-news timestamp. News may
                    be delayed or incomplete.
                  </p>
                </details>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </section>
  );
}

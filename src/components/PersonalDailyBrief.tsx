"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchJsonWithTimeout } from "@/app/components/evidence-request";
import { loadPositions } from "@/lib/portfolio/persist";
import { briefContext, briefNames, selectBriefStories, type BriefStory } from "@/lib/watchlist/daily-brief";
import type { EvidenceEvent } from "@/lib/evidence/types";
import { trackProductEvent } from "@/lib/product-analytics";

type NewsResult = { status: string; events: EvidenceEvent[] };
const newsCache = new Map<string, { at: number; value: NewsResult }>();
const COVERAGE_LIMIT = 6;

export function PersonalDailyBrief({ tickers, loading }: { tickers: string[]; loading: boolean }) {
  const [held, setHeld] = useState<string[]>([]);
  const [portfolioReady, setPortfolioReady] = useState(false);
  const [portfolioError, setPortfolioError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; stories: BriefStory[]; failed: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setPortfolioReady(false);
    void fetchJsonWithTimeout<{ authenticated: boolean; positions: Array<{ ticker: string }> }>(
      "/api/portfolio", 8000, controller.signal,
    ).then((data) => {
      if (controller.signal.aborted) return;
      setHeld((data.authenticated ? data.positions : loadPositions()).map((p) => p.ticker));
      setPortfolioError(false);
    }).catch(() => {
      if (!controller.signal.aborted) setPortfolioError(true);
    }).finally(() => {
      if (!controller.signal.aborted) setPortfolioReady(true);
    });
    return () => controller.abort();
  }, [retry]);

  const names = briefNames(held, tickers);
  const covered = names.slice(0, COVERAGE_LIMIT);
  const key = JSON.stringify(covered);
  const ready = portfolioReady && !loading;

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const selected = JSON.parse(key) as ReturnType<typeof briefNames>;
    let cursor = 0;
    let failed = 0;
    const stories: BriefStory[] = [];
    async function worker() {
      while (cursor < selected.length && !controller.signal.aborted) {
        const name = selected[cursor++];
        try {
          const cached = newsCache.get(name.ticker);
          const news = cached && Date.now() - cached.at < 15 * 60_000 ? cached.value :
            await fetchJsonWithTimeout<NewsResult>(`/api/evidence/news?ticker=${encodeURIComponent(name.ticker)}`, 10000, controller.signal);
          if (!["success", "empty"].includes(news.status) || !Array.isArray(news.events)) throw new Error("Unavailable");
          if (!cached || cached.value !== news) newsCache.set(name.ticker, { at: Date.now(), value: news });
          if (newsCache.size > 100) newsCache.delete(newsCache.keys().next().value!);
          // One company cannot fill all three positions in the brief.
          const story = selectBriefStories(news.events.map((event) => ({ ...name, event })))[0];
          if (story) stories.push(story);
        } catch {
          failed++;
        }
      }
    }
    void Promise.all([worker(), worker()]).then(() => {
      if (controller.signal.aborted) return;
      setResult({ key, stories: selectBriefStories(stories), failed });
      if (stories.length) trackProductEvent("daily_brief_viewed");
    });
    return () => controller.abort();
  }, [key, ready, retry]);

  const current = result?.key === key ? result : null;
  const busy = !ready || (covered.length > 0 && !current);
  return (
    <section className="personal-brief" aria-labelledby="personal-brief-heading" aria-busy={busy}>
      <header className="personal-brief-header">
        <div><span className="personal-brief-eyebrow">MY STOCKS · LAST 48 HOURS</span>
          <h2 id="personal-brief-heading">Your daily brief</h2>
          <p>What changed. Why it matters. The evidence behind it.</p></div>
        <Link href="/manage?view=watchlist" className="data-edit-pill">Choose companies →</Link>
      </header>
      {busy ? <p role="status">Checking recent company news…</p> : names.length === 0 && !portfolioError ? (
        <div className="personal-brief-empty"><h3>Start with three companies you care about.</h3>
          <p>Add names to your watchlist. Your brief starts with the first one—no account required.</p>
          <Link href="/manage?view=watchlist" className="brief-link" onClick={() => trackProductEvent("brief_setup_started")}>Build my brief →</Link>
        </div>
      ) : <>
        {current?.stories.length ? <div className="personal-brief-stories">
          {current.stories.map(({ ticker, held: isHeld, event }, index) => (
            <article key={ticker}>
              <div className="personal-brief-meta"><span>{String(index + 1).padStart(2, "0")} · {ticker}</span><span>{isHeld ? "You own" : "You watch"}</span></div>
              <h3>{event.title}</h3>
              <p>{event.summary || "A recent company development to review alongside your investment thesis."}</p>
              <details><summary>Why it matters</summary><p>{briefContext(event, ticker)}</p></details>
              <footer><span>{event.metadata?.publisher || "Source report"} · <time dateTime={event.date}>{new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</time></span>
                <a href={event.sourceUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackProductEvent("brief_evidence_opened")}>Read source ↗</a>
                <Link href={`/companies/${encodeURIComponent(ticker)}`} onClick={() => trackProductEvent("brief_evidence_opened")}>Research {ticker} →</Link></footer>
            </article>
          ))}
        </div> : <p>No recent sourced developments found in the available coverage.</p>}
        {portfolioError || Boolean(current?.failed) ? <p role="status" className="personal-brief-warning">{portfolioError ? "Holdings could not be loaded. " : ""}{current?.failed ? `News unavailable for ${current.failed} checked name${current.failed === 1 ? "" : "s"}. ` : ""}This brief may be incomplete. <button type="button" onClick={() => { setResult(null); setRetry((n) => n + 1); }}>Try again</button></p> : null}
        {covered.length ? <p className="personal-brief-coverage">Checking {covered.map((n) => n.ticker).join(", ")}{names.length > COVERAGE_LIMIT ? ` · ${COVERAGE_LIMIT} of ${names.length} names, holdings first` : ""}. News may be delayed; this is not a complete market scan.</p> : null}
      </>}
    </section>
  );
}

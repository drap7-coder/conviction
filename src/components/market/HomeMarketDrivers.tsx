"use client";

import Link from "next/link";
import { primaryHeadline } from "@/lib/market/news-hero";
import { usePulseHomeNews } from "@/components/market/PulseTodaysBrief";
import styles from "./HomeEditorial.module.css";

/** Editorial entry point; full movers and news browsing remain on their own pages. */
export function HomeMarketDrivers() {
  const news = usePulseHomeNews();
  const stories = news.todaysBrief.flatMap(theme => {
    const headline = primaryHeadline(theme);
    return headline ? [{ theme, headline }] : [];
  }).slice(0, 3);

  return <section className={styles.news} aria-labelledby="home-driver-news-heading">
    <header className={styles.panelHeading}>
      <div><p className={styles.eyebrow}>Keep the bigger picture</p><h2 id="home-driver-news-heading">Three headlines to know</h2></div>
      <Link href="/news" className={styles.textLink}>Explore News →</Link>
    </header>
    <p className={styles.dek}>Reporting behind the market conversation. Open a story to read the source.</p>
    {news.status === "loading" ? <p className={styles.empty} role="status">Finding sourced market headlines…</p> : null}
    {news.status === "unavailable" ? <p className={styles.empty} role="status">Headlines are temporarily unavailable. Try News again later.</p> : null}
    {news.status === "ready" && stories.length === 0 ? <p className={styles.empty}>No sourced headlines are available right now. This does not mean there is no market news.</p> : null}
    <ol className={styles.stories}>
      {stories.map(({ theme, headline }, index) => <li key={theme.id}>
        <span className={styles.storyNumber} aria-hidden="true">0{index + 1}</span>
        <article>
          <p className={styles.eyebrow}>{theme.label}</p>
          <h3>{headline.url ? <a href={headline.url} target="_blank" rel="noopener noreferrer">{headline.title}<span className="sr-only"> (opens in a new tab)</span></a> : headline.title}</h3>
          <p className={styles.byline}>{headline.publisher?.trim() || "Market source"}{Number.isFinite(Date.parse(headline.date)) ? <> · <time dateTime={headline.date}>{new Date(headline.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" })} ET</time></> : null}</p>
        </article>
      </li>)}
    </ol>
    <footer className={styles.nextSteps}><p>Ready to make it personal?</p><Link href="/portfolio?view=watchlist" className={styles.textLink}>Open your watchlist →</Link></footer>
  </section>;
}

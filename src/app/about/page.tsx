import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import {
  PRODUCT_ABOUT_LEDE,
  PRODUCT_ONE_LINER,
  PRODUCT_SURFACES,
} from "@/lib/product-copy";
import styles from "../legal.module.css";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "What CONVICTION is today: a daily market workspace for Pulse, Watchlist, Portfolio, News, Sectors, International, and Smart Money.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>About</span>
        <h1>CONVICTION today</h1>
        <p>{PRODUCT_ABOUT_LEDE}</p>
        <p>{PRODUCT_ONE_LINER}</p>
      </header>

      <section className={styles.section}>
        <h2>What you get</h2>
        <ul>
          {PRODUCT_SURFACES.map((surface) => (
            <li key={surface.href}>
              <strong>
                <Link href={surface.href}>{surface.name}</Link>
              </strong>
              {" — "}
              {surface.blurb}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2>What it is not</h2>
        <p>
          CONVICTION is not a brokerage, not a trading platform, and not personalized investment
          advice. It is a research and organization tool so you can see the market, your lists,
          and your book in one place.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Questions</h2>
        <p>
          Common answers live on{" "}
          <Link href="/faq">Q&amp;A</Link>
          . Privacy and terms are under{" "}
          <Link href="/privacy">Privacy</Link>
          {" "}and{" "}
          <Link href="/terms">Terms</Link>
          .
        </p>
      </section>
    </main>
  );
}

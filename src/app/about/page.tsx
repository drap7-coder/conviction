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
    "What IQBulls is: raising your market IQ with Pulse, Crowd, Portfolio, and News.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <img
          className={styles.brandMark}
          src="/iqbulls-bull.png"
          alt=""
          aria-hidden="true"
          width={40}
          height={40}
        />
        <span className={styles.eyebrow}>About</span>
        <h1>
          <span className={styles.brandIq}>IQ</span>
          <span className={styles.brandBulls}>Bulls</span>
        </h1>
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
          IQBulls is not a brokerage, not a trading platform, and not personalized investment
          advice. It is research and organization — so you can see the market, your lists,
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

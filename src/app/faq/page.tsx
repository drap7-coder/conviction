import type { Metadata } from "next";
import Link from "next/link";
import { faqJsonLd, pageMetadata } from "@/lib/seo";
import { PRODUCT_FAQ } from "@/lib/product-copy";
import styles from "../legal.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Q&A",
  description:
    "Answers about CONVICTION today — Pulse, Watchlist, Portfolio, data sources, accounts, and Smart Money.",
  path: "/faq",
});

export default function FaqPage() {
  return (
    <main className={styles.page}>
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(PRODUCT_FAQ)) }}
      />

      <header className={styles.hero}>
        <span className={styles.eyebrow}>Help</span>
        <h1>Q&amp;A</h1>
        <p>
          Straight answers about the product as it ships today. For the longer pitch, see{" "}
          <Link href="/about">About</Link>.
        </p>
      </header>

      {PRODUCT_FAQ.map((item) => (
        <section key={item.question} className={styles.section}>
          <h2>{item.question}</h2>
          <p>{item.answer}</p>
        </section>
      ))}
    </main>
  );
}

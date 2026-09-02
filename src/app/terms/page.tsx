import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import styles from "../legal.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Terms",
  description: "Terms for using IQBulls market research and portfolio tools.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>The agreement</span>
        <h1>Terms</h1>
        <p>IQBulls is a research and organization tool, not a brokerage or adviser.</p>
        <span className={styles.updated}>Effective August 24, 2026</span>
      </header>

      <section className={styles.section}>
        <h2>Use of the service</h2>
        <p>
          You may use IQBulls for lawful personal research and portfolio organization. You
          are responsible for your account activity and for keeping access to your Google
          account secure. Do not interfere with the service, attempt unauthorized access, or
          use it to violate another person&apos;s rights.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Not investment advice</h2>
        <p>
          Market data, summaries, scores, watchlists, portfolio comparisons, and other content
          are informational and educational. They are not personalized investment, legal, or
          tax advice and are not an offer or recommendation to buy or sell a security. You are
          responsible for your own decisions.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Data and availability</h2>
        <p>
          IQBulls relies on third-party market, filing, news, authentication, hosting, and
          database services. Information may be delayed, incomplete, or inaccurate, and the
          service may change or be unavailable. Verify important information with primary
          sources before acting on it.
        </p>
      </section>

      <section className={styles.section}>
        <h2>No warranties; limited liability</h2>
        <p>
          IQBulls is provided on an &quot;as is&quot; and &quot;as available&quot; basis to the
          fullest extent permitted by law. We do not guarantee accuracy, uninterrupted access,
          or investment outcomes. To the fullest extent permitted by law, IQBulls and its
          operators are not liable for trading losses, lost data, or indirect or consequential
          damages arising from use of the service.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Changes and contact</h2>
        <p>
          We may update these terms or the service. Continued use after an update means you
          accept the revised terms. Questions can be sent to{" "}
          <a href="mailto:nathandrapkin@gmail.com">nathandrapkin@gmail.com</a>.
        </p>
      </section>

      <nav className={styles.links} aria-label="Legal and product links">
        <Link href="/privacy">Privacy</Link>
        <Link href="/pulse">Back to IQBulls</Link>
      </nav>
    </main>
  );
}

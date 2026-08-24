import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo";
import styles from "../legal.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Privacy",
  description: "How Conviction handles account, watchlist, and portfolio data.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.eyebrow}>Your data</span>
        <h1>Privacy</h1>
        <p>
          Conviction collects only what it needs to sign you in, sync the lists you choose,
          and run the product.
        </p>
        <span className={styles.updated}>Effective August 24, 2026</span>
      </header>

      <section className={styles.section}>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Google account basics:</strong> your name, email address, profile image,
            and Google account identifier when you choose to sign in.
          </li>
          <li>
            <strong>Your lists:</strong> the tickers and position details you add to your
            watchlist or portfolio.
          </li>
          <li>
            <strong>Essential technical data:</strong> session cookies and limited service
            logs used to keep the app secure and reliable.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2>How we use it</h2>
        <p>
          We use this information to authenticate you, sync your watchlist and portfolio
          across devices, protect the service, diagnose errors, and improve Conviction. We do
          not sell your personal information or use your Google data for advertising.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Where it lives</h2>
        <p>
          Signed-in watchlists, portfolios, and account records are stored in Neon Postgres.
          Conviction is hosted on Vercel, and Google provides sign-in. Guest data remains in
          your browser unless you choose to sign in and sync it. Conviction never receives
          your Google password.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Sharing and retention</h2>
        <p>
          We share data only with service providers that operate Conviction, when required by
          law, or to protect the service and its users. We retain account data while your
          account is active and as reasonably necessary for security, legal, and operational
          purposes.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Your choices</h2>
        <p>
          You can use Conviction in guest mode, edit or remove synced tickers from Manage,
          and sign out at any time. To request access to or deletion of your account data,
          email <a href="mailto:nathandrapkin@gmail.com">nathandrapkin@gmail.com</a>.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Updates</h2>
        <p>
          We may update this policy as the product changes. The effective date above will be
          revised when that happens. Conviction is not directed to children under 13.
        </p>
      </section>

      <nav className={styles.links} aria-label="Legal and product links">
        <Link href="/terms">Terms</Link>
        <Link href="/pulse">Back to Conviction</Link>
      </nav>
    </main>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { GuestModeBanner } from "@/app/components/GuestModeBanner";
import Watchlist from "@/components/Watchlist";
import { PortfolioManager } from "@/components/PortfolioManager";
import { isAuthConfigured } from "@/lib/auth-readiness";
import { getOptionalSession } from "@/lib/auth-session";
import { pageMetadata } from "@/lib/seo";
import "./manage.css";

export const metadata: Metadata = pageMetadata({
  title: "Manage",
  description: "Edit your Conviction watchlist and portfolio in one focused workspace.",
  path: "/manage",
  index: false,
});

export default async function ManagePage() {
  const session = await getOptionalSession();
  const accountLabel = session?.user?.name ?? session?.user?.email ?? null;

  return (
    <main className="data-manage-page">
      <header className="data-manage-hero">
        <span>Your data</span>
        <h1>Manage</h1>
        <p>Edit the lists here. Keep Watchlist and Portfolio focused on what matters now.</p>
        <GuestModeBanner
          authenticated={Boolean(session?.user)}
          authConfigured={isAuthConfigured()}
          accountLabel={accountLabel}
        />
        <nav className="data-manage-jumps" aria-label="Manage sections">
          <a href="#watchlist">Watchlist</a>
          <a href="#portfolio">Portfolio</a>
        </nav>
      </header>

      <div className="data-manage-sections">
        <Watchlist mode="manage" />
        <PortfolioManager />
      </div>

      <footer className="data-manage-backlinks">
        <Link href="/watchlist">View Watchlist</Link>
        <Link href="/portfolio">View Portfolio</Link>
      </footer>
    </main>
  );
}

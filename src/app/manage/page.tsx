import type { Metadata } from "next";
import Link from "next/link";
import { GuestModeBanner } from "@/app/components/GuestModeBanner";
import { ManageWorkspace } from "@/components/ManageWorkspace";
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
        <p>Edit one list at a time. Add by typing or the mic in the ticker field.</p>
        <GuestModeBanner
          authenticated={Boolean(session?.user)}
          authConfigured={isAuthConfigured()}
          accountLabel={accountLabel}
        />
      </header>

      <ManageWorkspace />

      <footer className="data-manage-backlinks">
        <Link href="/portfolio?view=watchlist">View Watchlist</Link>
        <Link href="/portfolio">View Portfolio</Link>
      </footer>
    </main>
  );
}

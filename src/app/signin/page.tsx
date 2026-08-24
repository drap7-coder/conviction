import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "../../../auth";
import { isAuthConfigured } from "@/lib/auth-readiness";
import { pageMetadata } from "@/lib/seo";
import styles from "./signin.module.css";

export const metadata: Metadata = pageMetadata({
  title: "Sign in",
  description: "Create or access your Conviction account with Google.",
  path: "/signin",
  index: false,
});

type SignInSearchParams = Promise<{
  callbackUrl?: string | string[];
  error?: string | string[];
}>;

function safeRedirectTo(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.startsWith("/") && !candidate.startsWith("//") ? candidate : "/manage";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: SignInSearchParams;
}) {
  const session = process.env.AUTH_SECRET ? await auth() : null;
  if (session?.user) redirect("/manage");

  const params = await searchParams;
  const redirectTo = safeRedirectTo(params.callbackUrl);
  const hasError = Boolean(params.error);
  const configured = isAuthConfigured();

  async function continueWithGoogle() {
    "use server";
    await signIn("google", { redirectTo });
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="signin-title">
        <span className={styles.eyebrow}>Your Conviction account</span>

        <div className={styles.copy}>
          <h1 id="signin-title">Your lists. On every device.</h1>
          <p>Continue with Google to sign in securely.</p>
        </div>

        <p className={styles.accountNote}>
          New to Conviction? Your first sign-in creates the account automatically. No separate
          username or password.
        </p>

        <p className={styles.detail}>
          Google confirms who you are. Conviction stores your account, watchlist, and portfolio
          privately in Neon.
        </p>

        {hasError ? (
          <p className={styles.error} role="alert">
            We couldn&apos;t complete sign-in. Please try again with the same Google account.
          </p>
        ) : null}

        <form className={styles.form} action={continueWithGoogle}>
          <button className={styles.continueButton} type="submit" disabled={!configured}>
            Continue with Google
          </button>
        </form>

        {!configured ? (
          <p className={styles.unavailable}>Google sign-in is not configured in this environment.</p>
        ) : null}

        <nav className={styles.links} aria-label="Account options">
          <Link href="/pulse">Keep browsing as guest</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>
      </section>
    </main>
  );
}

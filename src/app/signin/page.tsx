import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "../../../auth";
import { isAuthConfigured } from "@/lib/auth-readiness";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl?.startsWith("/") ? params.callbackUrl : "/watchlist";
  const authConfigured = isAuthConfigured();
  const session = authConfigured ? await auth() : null;

  if (session?.user) {
    redirect(callbackUrl);
  }

  async function signInWithGitHub() {
    "use server";
    await signIn("github", { redirectTo: callbackUrl });
  }

  return (
    <main className="signin-page">
      <section className="signin-card ink-panel" aria-label="Sign in">
        <span className="signin-eyebrow">CONVICTION</span>
        <h1>Save your watchlist across devices.</h1>
        <p>
          Sign in with GitHub to sync names you track. Guest mode still works on this browser.
        </p>

        {params.error ? (
          <p className="signin-error" role="alert">
            Sign in didn’t complete. Try again, or keep browsing as a guest.
          </p>
        ) : null}

        {authConfigured ? (
          <form action={signInWithGitHub}>
            <button type="submit" className="signin-cta">
              Continue with GitHub
            </button>
          </form>
        ) : (
          <p className="signin-disabled">
            Sign in isn’t configured on this deploy yet. Guest browsing still works.
          </p>
        )}

        <Link href="/watchlist" className="signin-secondary">
          Continue as guest
        </Link>
      </section>
    </main>
  );
}

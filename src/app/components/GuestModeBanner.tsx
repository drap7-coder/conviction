"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";

const DISMISS_KEY = "conviction:guest-banner-dismissed";

export function GuestModeBanner({
  authenticated,
  authConfigured,
}: {
  authenticated: boolean;
  authConfigured: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable; show banner
    }

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("error");
    if (authError) {
      setError("Sign in didn’t complete. Try again.");
    }
  }, []);

  if (!mounted || authenticated || dismissed) return null;

  function handleDismiss() {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // best-effort
    }
  }

  async function handleSignIn() {
    if (!authConfigured || busy) return;
    setBusy(true);
    setError(null);
    try {
      await signIn("github", { callbackUrl: "/watchlist" });
    } catch {
      setError("Sign in didn’t complete. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="guest-banner ink-box ink-box--quiet" role="status">
      <span className="guest-banner-text">
        {error
          ? error
          : "Browsing as guest — sign in to save your watchlist across devices."}
      </span>
      <div className="guest-banner-actions">
        {authConfigured ? (
          <button
            type="button"
            className="guest-banner-link"
            onClick={() => void handleSignIn()}
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in with GitHub"}
          </button>
        ) : (
          <span className="guest-banner-link disabled" aria-disabled="true">
            Sign in coming soon
          </span>
        )}
        <button
          type="button"
          className="guest-banner-dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss guest banner"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "conviction:guest-banner-dismissed";

export function GuestModeBanner({
  authenticated,
  authConfigured,
  accountLabel,
}: {
  authenticated: boolean;
  authConfigured: boolean;
  accountLabel: string | null;
}) {
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === "1") {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable; show banner
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

  return (
    <div className="guest-banner" role="status">
      <span className="guest-banner-text">
        Browsing as guest — sign in to save your watchlist across devices.
      </span>
      <div className="guest-banner-actions">
        {authConfigured ? (
          <a className="guest-banner-link" href="/api/auth/signin/github">
            Sign in
          </a>
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
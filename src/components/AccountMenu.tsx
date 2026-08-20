"use client";

import { useEffect, useId, useRef, useState } from "react";
import { signIn, signOut } from "next-auth/react";

type AccountUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function AccountMenu({
  authConfigured,
  user,
}: {
  authConfigured: boolean;
  user: AccountUser | null;
}) {
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleSignIn() {
    if (!authConfigured || busy) return;
    setBusy(true);
    try {
      await signIn("github", { callbackUrl: "/watchlist" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    setOpen(false);
    try {
      await signOut({ callbackUrl: "/watchlist" });
    } finally {
      setBusy(false);
    }
  }

  if (!user) {
    return (
      <div className="account-menu">
        {authConfigured ? (
          <button
            type="button"
            className="account-menu-signin"
            onClick={() => void handleSignIn()}
            disabled={busy}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        ) : (
          <span className="account-menu-soon" title="Add Neon + GitHub OAuth env vars to enable sign in">
            Sign in soon
          </span>
        )}
      </div>
    );
  }

  const label = user.name?.trim() || user.email?.trim() || "Account";
  const initial = label.charAt(0).toUpperCase();

  return (
    <div className="account-menu" ref={rootRef}>
      <button
        type="button"
        className="account-menu-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="account-menu-avatar" />
        ) : (
          <span className="account-menu-initial" aria-hidden="true">{initial}</span>
        )}
        <span className="account-menu-label">{label}</span>
      </button>

      {open ? (
        <div id={menuId} className="account-menu-dropdown" role="menu">
          <div className="account-menu-meta">
            <strong>{label}</strong>
            {user.email ? <span>{user.email}</span> : null}
          </div>
          <button
            type="button"
            className="account-menu-item"
            role="menuitem"
            onClick={() => void handleSignOut()}
            disabled={busy}
          >
            {busy ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import Watchlist from "@/components/Watchlist";

/**
 * Watchlist board shell — also embedded on Portfolio (`?view=watchlist`).
 */
export default function MyListShell({ publicFeed }: { publicFeed?: ReactNode }) {
  return (
    <div className="my-list-shell">
      <Watchlist>
        {publicFeed}
      </Watchlist>
    </div>
  );
}

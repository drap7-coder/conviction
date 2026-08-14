"use client";

import type { ReactNode } from "react";
import Watchlist from "@/components/Watchlist";

/**
 * Watchlist page shell. Portfolio lives on its own `/portfolio` tab now.
 */
export default function MyListShell({ publicFeed }: { publicFeed?: ReactNode }) {
  return (
    <div className="my-list-shell">
      <Watchlist composeFirst>
        {publicFeed}
      </Watchlist>
    </div>
  );
}

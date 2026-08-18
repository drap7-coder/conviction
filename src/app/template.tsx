import type { ReactNode } from "react";

/**
 * Remount page content on navigation so CSS load arrivals replay.
 * `display: contents` keeps this wrapper out of layout.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page-slot">{children}</div>;
}

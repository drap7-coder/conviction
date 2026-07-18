import React from "react";
import type { ThesisStatus } from "@/lib/watchlist/types";

interface StatusBadgeProps {
  status: ThesisStatus;
}

const statusMap: Record<ThesisStatus, string> = {
  building: "bg-stone-100 text-stone-600 border-stone-200",
  supported: "bg-emerald-50 text-emerald-700 border-emerald-200",
  review: "bg-orange-50 text-orange-700 border-orange-200", // Using orange for review
  weakening: "bg-rose-50 text-rose-700 border-rose-200",
  broken: "bg-red-50 text-red-700 border-red-200", // Using red for broken
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const classes = statusMap[status] || statusMap.building; // Fallback to building
  return (
    <span
      className={`absolute top-2 right-2 px-2 py-1 text-xs font-semibold rounded-full border ${classes} `}
      style={{ backdropFilter: "blur(2px)" }} // Apply subtle backdrop blur
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

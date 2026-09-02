"use client";

import { useEffect, useMemo, useState } from "react";

export type SchoolLogoProps = {
  /** Full institution name (e.g. "William & Mary"). */
  name: string;
  /** Web domain for favicon fallback (e.g. "wm.edu"). */
  domain?: string | null;
  /** NCAA slug or ESPN numeric team id. */
  ncaaId?: string | number | null;
  /** Accent used for initials badge. */
  accentColor?: string | null;
  /** Pixel width/height. */
  size?: number;
  className?: string;
};

/**
 * Slug → ESPN team id for schools whose catalog `ncaaId` is a slug, not a number.
 * ESPN CDN: https://a.espncdn.com/i/teamlogos/ncaa/500/{id}.png
 */
const ESPN_TEAM_IDS: Record<string, string> = {
  "william-mary": "2729",
  rensselaer: "2528",
  njit: "2885",
  stevens: "2847",
  duke: "150",
  "north-carolina": "153",
  virginia: "258",
  villanova: "222",
};

type LogoStage = "espn" | "favicon" | "badge";

function resolveEspnId(ncaaId: string | number | null | undefined): string | null {
  if (ncaaId === null || ncaaId === undefined) return null;
  const raw = String(ncaaId).trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;
  return ESPN_TEAM_IDS[raw.toLowerCase()] ?? null;
}

/** Derive compact initials: "William & Mary" → "W&M", "Rensselaer Polytechnic Institute" → "RPI". */
export function schoolInitials(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return "?";

  const ampMatch = cleaned.match(
    /^([A-Za-z][A-Za-z']*)\s*&\s*([A-Za-z][A-Za-z']*)/,
  );
  if (ampMatch) {
    return `${ampMatch[1][0]}&${ampMatch[2][0]}`.toUpperCase();
  }

  const stop = new Set(["of", "the", "and", "at"]);
  const words = cleaned
    .split(/[\s-]+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean);

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  const significant = words.filter((w) => !stop.has(w.toLowerCase()));
  const source = significant.length > 0 ? significant : words;
  return source
    .slice(0, 3)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function espnLogoUrl(espnId: string): string {
  return `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`;
}

function faviconUrl(domain: string): string {
  const cleaned = domain
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0];
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(cleaned)}&sz=128`;
}

function contrastInk(hex: string | null | undefined): string {
  if (!hex || !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex)) return "#ffffff";
  const full =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex;
  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

/**
 * School mark with graceful fallback: ESPN CDN → Google favicon → initials badge.
 */
export function SchoolLogo({
  name,
  domain,
  ncaaId,
  accentColor,
  size = 32,
  className,
}: SchoolLogoProps) {
  const espnId = useMemo(() => resolveEspnId(ncaaId), [ncaaId]);
  const hasDomain = Boolean(domain?.trim());

  const initialStage: LogoStage = espnId ? "espn" : hasDomain ? "favicon" : "badge";
  const [stage, setStage] = useState<LogoStage>(initialStage);

  useEffect(() => {
    setStage(espnId ? "espn" : hasDomain ? "favicon" : "badge");
  }, [espnId, hasDomain, name, domain, ncaaId]);

  const initials = schoolInitials(name);
  const bg = accentColor?.trim() || "var(--card-soft, #e5e7eb)";
  const ink = contrastInk(accentColor);

  if (stage === "espn" && espnId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={espnLogoUrl(espnId)}
        alt=""
        width={size}
        height={size}
        className={`school-logo school-logo-img${className ? ` ${className}` : ""}`}
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
        onError={() => setStage(hasDomain ? "favicon" : "badge")}
      />
    );
  }

  if (stage === "favicon" && hasDomain && domain) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={faviconUrl(domain)}
        alt=""
        width={size}
        height={size}
        className={`school-logo school-logo-img${className ? ` ${className}` : ""}`}
        style={{ width: size, height: size }}
        loading="lazy"
        decoding="async"
        onError={() => setStage("badge")}
      />
    );
  }

  return (
    <span
      className={`school-logo school-logo-badge${className ? ` ${className}` : ""}`}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: ink,
        fontSize: Math.max(10, Math.round(size * 0.34)),
      }}
      aria-hidden="true"
      title={name}
    >
      {initials}
    </span>
  );
}

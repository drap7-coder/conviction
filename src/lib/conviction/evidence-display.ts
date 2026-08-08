/**
 * Display helpers for the company-detail Evidence module:
 * status semantics, plain-language copy, composite synthesis.
 */

export type EvidenceSemantic = "support" | "mixed" | "against" | "quiet";

export type EvidenceLaneId =
  | "institutional"
  | "insider"
  | "technicals"
  | "short_interest"
  | "earnings"
  | "political"
  | "ownership"
  | "disclosures";

export type EvidenceLaneCopy = {
  primary: string;
  secondary?: string | null;
};

export type EvidenceGroupId = "ownership_flow" | "fundamentals" | "market_signals";

export const EVIDENCE_GROUPS: Array<{
  id: EvidenceGroupId;
  label: string;
  laneIds: EvidenceLaneId[];
}> = [
  {
    id: "ownership_flow",
    label: "Ownership & Flow",
    laneIds: ["institutional", "insider", "political", "ownership"],
  },
  {
    id: "fundamentals",
    label: "Fundamentals",
    laneIds: ["earnings", "disclosures"],
  },
  {
    id: "market_signals",
    label: "Market Signals",
    laneIds: ["technicals", "short_interest"],
  },
];

export const EVIDENCE_LANE_META: Record<
  EvidenceLaneId,
  { label: string; icon: string }
> = {
  institutional: { label: "Institutional", icon: "🏦" },
  insider: { label: "Insider", icon: "👤" },
  political: { label: "Political", icon: "🏛" },
  ownership: { label: "Ownership", icon: "📄" },
  earnings: { label: "Earnings", icon: "📈" },
  disclosures: { label: "Filings", icon: "🗂" },
  technicals: { label: "Technicals", icon: "📊" },
  short_interest: { label: "Short interest", icon: "🩳" },
};

export function evidenceSemantic(input: {
  tone: "positive" | "negative" | "neutral" | "unavailable";
  status: "loading" | "available" | "stale" | "unavailable" | "quiet";
}): EvidenceSemantic | "loading" | "unavailable" {
  if (input.status === "loading") return "loading";
  if (input.status === "quiet") return "quiet";
  if (input.status === "unavailable" || input.status === "stale") return "unavailable";
  if (input.tone === "positive") return "support";
  if (input.tone === "negative") return "against";
  if (input.tone === "unavailable") return "unavailable";
  return "mixed";
}

export function evidenceStatusLabel(semantic: EvidenceSemantic | "loading" | "unavailable"): string {
  if (semantic === "loading") return "…";
  if (semantic === "unavailable") return "—";
  if (semantic === "support") return "Support";
  if (semantic === "against") return "Against";
  if (semantic === "quiet") return "Quiet";
  return "Mixed";
}

function joinNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!.toLowerCase();
  if (names.length === 2) return `${names[0]!.toLowerCase()} and ${names[1]!.toLowerCase()}`;
  return `${names.slice(0, -1).map((n) => n.toLowerCase()).join(", ")}, and ${names.at(-1)!.toLowerCase()}`;
}

export function countEvidenceSemantics(
  semantics: Array<EvidenceSemantic | "loading" | "unavailable">,
): Record<EvidenceSemantic, number> {
  const counts: Record<EvidenceSemantic, number> = {
    support: 0,
    mixed: 0,
    against: 0,
    quiet: 0,
  };
  for (const semantic of semantics) {
    if (semantic === "support" || semantic === "mixed" || semantic === "against" || semantic === "quiet") {
      counts[semantic] += 1;
    } else if (semantic === "unavailable") {
      counts.quiet += 1;
    }
  }
  return counts;
}

/** Overall badge from majority of row-level statuses. */
export function compositeEvidenceLabel(
  counts: Record<EvidenceSemantic, number>,
): EvidenceSemantic {
  const { support, mixed, against, quiet } = counts;
  const directional = support + against;
  if (directional === 0 && mixed === 0) return "quiet";
  if (support > against && support >= mixed) return "support";
  if (against > support && against >= mixed) return "against";
  if (mixed > support && mixed > against && directional === 0) return "mixed";
  if (support === against && support > 0) return "mixed";
  if (quiet >= support + against + mixed) return "quiet";
  return "mixed";
}

/**
 * One-line synthesis from which categories support / against / mixed.
 * Example: "Earnings and technicals lean bullish; institutional and political flows are split."
 */
export function synthesizeEvidenceRead(
  lanes: Array<{ label: string; semantic: EvidenceSemantic | "loading" | "unavailable" }>,
): string {
  const support = lanes.filter((lane) => lane.semantic === "support").map((lane) => lane.label);
  const against = lanes.filter((lane) => lane.semantic === "against").map((lane) => lane.label);
  const mixed = lanes.filter((lane) => lane.semantic === "mixed").map((lane) => lane.label);
  const quiet = lanes.filter((lane) => lane.semantic === "quiet").map((lane) => lane.label);

  const clauses: string[] = [];
  if (support.length > 0) {
    clauses.push(`${joinNames(support)} lean bullish`);
  }
  if (against.length > 0) {
    clauses.push(`${joinNames(against)} lean bearish`);
  }
  if (mixed.length > 0) {
    const flowish = mixed.every((name) =>
      /institutional|insider|political|ownership/i.test(name),
    );
    clauses.push(
      flowish
        ? `${joinNames(mixed)} flows are split`
        : `${joinNames(mixed)} are mixed`,
    );
  }

  if (clauses.length === 0) {
    if (quiet.length > 0) {
      return "Most categories are quiet — no strong directional read yet.";
    }
    return "Not enough live evidence yet to form a composite read.";
  }

  const lead = clauses.join("; ");
  if (support.length + against.length + mixed.length >= 4) {
    return `${lead.charAt(0).toUpperCase()}${lead.slice(1)}. No single category dominates the read.`;
  }
  return `${lead.charAt(0).toUpperCase()}${lead.slice(1)}.`;
}

export function plainLanguageLaneCopy(
  id: EvidenceLaneId,
  rawHeadline: string,
  options: {
    secondaryHint?: string | null;
    form?: string | null;
    filingDate?: string | null;
    ownershipTitle?: string | null;
  } = {},
): EvidenceLaneCopy {
  const text = rawHeadline.replace(/\s+/g, " ").trim();

  if (id === "institutional") {
    const adding = text.match(/(\d+)\s+adding or opening/i);
    const trimming = text.match(/(\d+)\s+trimming or exiting/i);
    if (adding && trimming) {
      const a = Number(adding[1]);
      const t = Number(trimming[1]);
      return {
        primary: `${a} fund${a === 1 ? "" : "s"} adding or opening new positions, ${t} trimming or exiting`,
      };
    }
    if (adding) {
      const a = Number(adding[1]);
      return { primary: `${a} fund${a === 1 ? "" : "s"} adding or opening new positions` };
    }
    if (/holding/i.test(text)) {
      return { primary: "Tracked funds are mostly holding their positions" };
    }
    return { primary: text.replace(/\.$/, "") };
  }

  if (id === "insider") {
    if (/no open-market/i.test(text) || /no executives/i.test(text)) {
      return { primary: "No executives or directors have bought shares recently" };
    }
    const filings = text.match(/(\d+)\s+filings/i);
    const dollars = text.match(/\$[\d,]+/);
    if (filings && dollars) {
      return {
        primary: `Executives and directors bought shares recently (${dollars[0]} across ${filings[1]} filings)`,
      };
    }
    return { primary: text.replace(/\.$/, "") };
  }

  if (id === "political") {
    const buys = text.match(/(\d+)\s+disclosed purchase/i);
    const trades = text.match(/(\d+)\s+disclosed trade/i);
    const date = text.match(/·\s*([A-Z][a-z]{2}\s+\d{1,2})/);
    if (buys) {
      const n = Number(buys[1]);
      return {
        primary: `${n} lawmaker${n === 1 ? "" : "s"} disclosed purchase${n === 1 ? "" : "s"}${date ? ` · ${date[1]}` : ""}`,
      };
    }
    if (trades) {
      const n = Number(trades[1]);
      return {
        primary: `${n} lawmaker${n === 1 ? "" : "s"} disclosed trade${n === 1 ? "" : "s"}${date ? ` · ${date[1]}` : ""}`,
      };
    }
    if (/no recent/i.test(text)) {
      return { primary: "No recent congressional trade matches" };
    }
    return { primary: text };
  }

  if (id === "ownership") {
    const title = options.ownershipTitle ?? text;
    const form = options.form ?? "";
    const filed = options.filingDate;
    const isPassive = /13g|passive/i.test(`${form} ${title}`);
    const isActivist = /13d|activist/i.test(`${form} ${title}`);
    const amended = /\/A|amend/i.test(form) || /amend/i.test(title);
    const primary = isPassive
      ? "A major passive fund (e.g. an index provider) updated its stake"
      : isActivist
        ? "An activist or active holder updated its ownership stake"
        : "A major holder updated its ownership stake";
    const secondary = filed
      ? `Filed ${filed}${amended ? " as amended ownership disclosure" : " as ownership disclosure"}`
      : amended
        ? "Amended ownership disclosure"
        : options.secondaryHint ?? null;
    return { primary, secondary };
  }

  if (id === "short_interest") {
    const change = text.match(/([+-]?\d+(?:\.\d+)?)%/);
    const dtc = text.match(/([\d.]+)\s*(?:days to cover|DTC)/i);
    const fell = /fell|eased|-/i.test(text) && !/\+/.test(change?.[0] ?? "");
    const rose = /rose|climb|\+/i.test(text);
    if (change && dtc) {
      const abs = change[1]!.replace(/^[+-]/, "");
      const verb = fell || (!rose && change[0]!.startsWith("-"))
        ? "fell"
        : rose || change[0]!.startsWith("+")
          ? "rose"
          : "moved";
      return {
        primary: `Bets against the stock ${verb} ${abs}%; would take ${dtc[1]} days of trading to cover them all`,
      };
    }
    return { primary: text.replace(/\.$/, "") };
  }

  if (id === "technicals") {
    if (/below sma50, above sma200|fallen below the short-term/i.test(text) && /above the long-term|above sma200/i.test(text)) {
      return {
        primary: "Price slipped below the short-term average but remains above the long-term trend",
      };
    }
    if (/above sma50 and sma200|above both/i.test(text)) {
      return { primary: "Price is holding above both short- and long-term averages" };
    }
    if (/below sma50 and sma200/i.test(text)) {
      return { primary: "Price is below both short- and long-term averages" };
    }
    return { primary: text.replace(/\.$/, "") };
  }

  if (id === "earnings") {
    const beat = text.match(/(\S+)\s+beat\s+·\s*([+-]?\d+(?:\.\d+)%)/i);
    const miss = text.match(/(\S+)\s+miss\s+·\s*([+-]?\d+(?:\.\d+)%)/i);
    if (beat) {
      return { primary: `${beat[1]} earnings beat estimates by ${beat[2]}` };
    }
    if (miss) {
      return { primary: `${miss[1]} earnings missed estimates by ${miss[2]}` };
    }
    return { primary: text };
  }

  if (id === "disclosures") {
    // Prefer plain title as primary; demote form/date codes.
    const filed = options.filingDate;
    const form = options.form;
    if (options.ownershipTitle || (!/·/.test(text) && text.length > 8)) {
      const title = options.ownershipTitle ?? text;
      return {
        primary: title,
        secondary: form || filed
          ? [form, filed ? `Filed ${filed}` : null].filter(Boolean).join(" · ")
          : null,
      };
    }
    const parts = text.split(" · ").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 2 && /^[A-Z0-9 /-]+$/i.test(parts[0]!) && parts[0]!.length <= 12) {
      return {
        primary: parts.slice(2).join(" · ") || parts.at(-1)!,
        secondary: parts.slice(0, 2).join(" · "),
      };
    }
    return { primary: text };
  }

  return { primary: text };
}

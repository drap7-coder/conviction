/**
 * Derive a short “today’s news” badge from headlines / driver themes.
 * Used on the company dashboard header and material-news brief.
 */

export type TodayCatalystTone = "positive" | "negative" | "contested" | "quiet";

export interface TodayCatalyst {
  /** Short badge copy, e.g. "Earnings today" */
  label: string;
  tone: TodayCatalystTone;
  /** Why this badge was chosen — for tests / debugging */
  kind: "earnings" | "trial" | "guidance" | "deal" | "regulatory" | "news";
}

export interface CatalystHeadlineInput {
  headline: string;
  date: string;
  /** Optional summary / body text to scan */
  summary?: string;
}

export interface DeriveTodayCatalystOptions {
  ticker?: string;
  companyName?: string | null;
  now?: Date;
}

interface CatalystRule {
  kind: TodayCatalyst["kind"];
  label: string;
  tone: TodayCatalystTone;
  pattern: RegExp;
  /** Higher wins when multiple rules match */
  priority: number;
}

const CATALYST_RULES: CatalystRule[] = [
  {
    kind: "earnings",
    label: "Earnings today",
    tone: "contested",
    priority: 100,
    pattern:
      /\bearnings\b|\breports?\s+q[1-4]\b|\bquarterly results\b|\bfiscal (?:q|quarter)|results (?:due|today|this week)|\beps\b|\bbeats? estimates?\b|\bmisses? estimates?\b/i,
  },
  {
    kind: "trial",
    label: "Trial setback",
    tone: "negative",
    priority: 105,
    pattern:
      /\btrial (?:fail|fails|failure|miss|misses)|(?:fail|fails|failed|miss|misses|missed)\b.{0,40}\b(?:trial|endpoint|phase)\b|(?:trial|phase\s*[123]|study)\b.{0,40}\b(?:fail|fails|failed|miss|misses|missed)\b|missed (?:its )?endpoint|pipeline setback|clinical (?:setback|failure)|safety (?:concern|signal)|fda (?:reject|complete response)|disappointing .{0,20}trial/i,
  },
  {
    kind: "trial",
    label: "Pipeline update",
    tone: "contested",
    priority: 70,
    pattern:
      /\bpipeline\b|\bphase [123]\b|\bclinical trial\b|\bfda\b|\bdrug (?:approval|candidate)|therapy|treatment data/i,
  },
  {
    kind: "guidance",
    label: "Guidance cut",
    tone: "negative",
    priority: 90,
    pattern:
      /\bcuts? guidance\b|\blower(?:s|ed)? guidance\b|\bguidance cut\b|\boutlook cut\b|\bwarns?\b.*\b(outlook|guidance|profit|revenue)/i,
  },
  {
    kind: "guidance",
    label: "Guidance raise",
    tone: "positive",
    priority: 88,
    pattern:
      /\braises? guidance\b|\blifts? guidance\b|\braises? outlook\b|\bupbeat (?:outlook|guidance)/i,
  },
  {
    kind: "deal",
    label: "Deal news",
    tone: "contested",
    priority: 80,
    pattern:
      /\btakeover\b|\bacquisition\b|\bbuyout\b|\bmerger\b|\boffer to (?:buy|acquire)|\bstrategic (?:review|alternatives)/i,
  },
  {
    kind: "regulatory",
    label: "Regulatory risk",
    tone: "negative",
    priority: 75,
    pattern:
      /\bantitrust\b|\binvestigation\b|\blawsuit\b|\bsec probe\b|\bdoj\b|\bftc\b|\bregulator(?:y)? (?:pressure|scrutiny|action)/i,
  },
];

/** Market-calendar “today” in US Eastern. */
export function marketTodayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function normalizeDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function isTodayOrYesterday(dateIso: string, todayIso: string): boolean {
  if (dateIso === todayIso) return true;
  const today = new Date(`${todayIso}T12:00:00Z`);
  const d = new Date(`${dateIso}T12:00:00Z`);
  if (!Number.isFinite(today.getTime()) || !Number.isFinite(d.getTime())) return false;
  const diffDays = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  return diffDays === 1;
}

function matchRule(text: string): CatalystRule | null {
  let best: CatalystRule | null = null;
  for (const rule of CATALYST_RULES) {
    if (!rule.pattern.test(text)) continue;
    if (!best || rule.priority > best.priority) best = rule;
  }
  return best;
}

function companyToken(companyName: string | null | undefined, ticker: string): string | null {
  return (companyName?.trim() || ticker)
    .replace(/[^a-z0-9 ]/gi, " ")
    .split(/\s+/)
    .find((token) => token.length >= 3 && !/^(the|inc|corp|corporation|company|holdings|ltd|plc)$/i.test(token))
    ?? null;
}

/** Prefer headlines that actually mention this company — skips market roundups. */
export function isCompanyRelevantHeadline(
  text: string,
  ticker?: string,
  companyName?: string | null,
): boolean {
  if (!ticker) return true;
  const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return true;
  const token = companyToken(companyName, ticker);
  if (token && new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
    return true;
  }
  return false;
}

/**
 * Pick a badge from today’s (or yesterday’s, for pre-market) headlines.
 * Falls back to driver theme labels when headlines lack a clear catalyst phrase.
 */
export function deriveTodayCatalyst(
  headlines: CatalystHeadlineInput[],
  driverLabel?: string | null,
  options: DeriveTodayCatalystOptions | Date = {},
): TodayCatalyst | null {
  // Back-compat: third arg used to be `now: Date`
  const opts: DeriveTodayCatalystOptions =
    options instanceof Date ? { now: options } : options;
  const now = opts.now ?? new Date();
  const todayIso = marketTodayIso(now);

  const relevant = headlines.filter((h) =>
    isCompanyRelevantHeadline(`${h.headline} ${h.summary ?? ""}`, opts.ticker, opts.companyName),
  );
  const scoped = relevant.length > 0 ? relevant : headlines;

  const recent = scoped.filter((h) => {
    const iso = normalizeDate(h.date);
    return iso ? isTodayOrYesterday(iso, todayIso) : false;
  });

  const pool = recent.length > 0 ? recent : scoped.slice(0, 3);

  let best: { rule: CatalystRule; fromToday: boolean } | null = null;
  for (const item of pool) {
    const text = `${item.headline} ${item.summary ?? ""}`;
    const rule = matchRule(text);
    if (!rule) continue;
    const iso = normalizeDate(item.date);
    const fromToday = iso ? isTodayOrYesterday(iso, todayIso) : false;
    if (
      !best ||
      rule.priority > best.rule.priority ||
      (rule.priority === best.rule.priority && fromToday && !best.fromToday)
    ) {
      best = { rule, fromToday };
    }
  }

  if (best) {
    let label = best.rule.label;
    // If the match is from yesterday and label says "today", soften it.
    if (!best.fromToday && label.endsWith(" today")) {
      label = label.replace(/ today$/, "");
    } else if (best.fromToday && best.rule.kind === "earnings" && !/today/i.test(label)) {
      label = "Earnings today";
    }
    return {
      label,
      tone: best.rule.tone,
      kind: best.rule.kind,
    };
  }

  // Driver-theme fallback when headlines are thematic but lack keyword hits
  const theme = (driverLabel ?? "").toLowerCase();
  if (!theme || theme.includes("still forming")) return null;

  if (theme.includes("pipeline")) {
    return { label: "Pipeline news", tone: "contested", kind: "trial" };
  }
  if (theme.includes("execution") || theme.includes("margin")) {
    return { label: "Earnings focus", tone: "contested", kind: "earnings" };
  }
  if (theme.includes("regulatory")) {
    return { label: "Regulatory risk", tone: "negative", kind: "regulatory" };
  }
  if (theme.includes("strategic") || theme.includes("options")) {
    return { label: "Deal news", tone: "contested", kind: "deal" };
  }

  return null;
}

/**
 * Derive a short “today’s news” badge from headlines / driver themes.
 * Used on the company dashboard header and material-news brief.
 */

import { matchesMarketInstrumentAlias } from "./market-instrument-aliases";

export type TodayCatalystTone = "positive" | "negative" | "contested" | "quiet";

export interface TodayCatalyst {
  /** Short badge copy, e.g. "Earnings today" */
  label: string;
  tone: TodayCatalystTone;
  /** Why this badge was chosen — for tests / debugging */
  kind:
    | "earnings"
    | "trial"
    | "guidance"
    | "deal"
    | "regulatory"
    | "analyst"
    | "news";
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

/** Headlines that look like upgrades but are not Street rating actions. */
const ANALYST_FALSE_POSITIVE =
  /\bcredit rating\b|\bsoftware upgrade\b|\bsystem upgrade\b|\bfirmware upgrade\b|\bnetwork upgrade\b|\binfrastructure upgrade\b|\bplant upgrade\b|\bfacility upgrade\b|\bdebt (?:rating|upgrade|downgrade)\b|\bmoodys\b|\bmoody'?s\b|\bs&p global ratings\b|\bfitch ratings\b/i;

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
    kind: "analyst",
    label: "Analyst upgrade",
    tone: "positive",
    priority: 96,
    pattern:
      /\b(?:analysts?|brokerages?)\b.{0,48}\bupgrad|\bupgrad(?:e|ed|es|ing)\b.{0,48}\b(?:to|overweight|outperform|buy|equal[\s-]?weight|neutral|hold|rating|price target)|\braises?\s+(?:the\s+)?(?:price\s+)?target|\bprice target raised|\bpt raised\b|\binitiates?(?:\s+\w+){0,3}\s+coverage|\breiterates?\s+(?:a\s+)?(?:buy|overweight|outperform)\b/i,
  },
  {
    kind: "analyst",
    label: "Analyst downgrade",
    tone: "negative",
    priority: 97,
    pattern:
      /\b(?:analysts?|brokerages?)\b.{0,48}\bdowngrad|\bdowngrad(?:e|ed|es|ing)\b.{0,48}\b(?:to|underweight|underperform|sell|equal[\s-]?weight|neutral|hold|rating|price target)|\bcuts?\s+(?:the\s+)?(?:price\s+)?target|\bprice target cut\b|\bpt cut\b|\breiterates?\s+(?:a\s+)?(?:sell|underweight|underperform)\b/i,
  },
  {
    kind: "analyst",
    label: "Price target move",
    tone: "contested",
    priority: 86,
    pattern:
      /\bprice targets?\b|\bpt to \$?\d|\btarget (?:price )?to \$?\d|\braises? .{0,20}\btarget\b|\blifts? .{0,20}\btarget\b|\bcuts? .{0,20}\btarget\b/i,
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
    // Skip Street-action rules when the headline is about credit ratings / IT upgrades.
    if (rule.kind === "analyst" && ANALYST_FALSE_POSITIVE.test(text)) continue;
    if (!best || rule.priority > best.priority) best = rule;
  }
  return best;
}

export interface GradeActionCatalystInput {
  date: string;
  direction: "upgrade" | "downgrade" | "maintain" | "initiate" | "other";
  firm?: string | null;
  previousGrade?: string | null;
  newGrade?: string | null;
  action?: string | null;
}

/**
 * Structured Street actions (FMP grades) → same badge language as news catalysts.
 * Only recent upgrade/downgrade/initiate rows mint a badge.
 */
export function catalystFromGradeActions(
  actions: GradeActionCatalystInput[],
  options: DeriveTodayCatalystOptions = {},
): TodayCatalyst | null {
  const now = options.now ?? new Date();
  const todayIso = marketTodayIso(now);

  const recent = actions.filter((action) => {
    if (action.direction !== "upgrade" && action.direction !== "downgrade" && action.direction !== "initiate") {
      return false;
    }
    const iso = normalizeDate(action.date);
    return iso ? isTodayOrYesterday(iso, todayIso) : false;
  });

  if (recent.length === 0) return null;

  const upgrades = recent.filter((action) => action.direction === "upgrade" || action.direction === "initiate");
  const downgrades = recent.filter((action) => action.direction === "downgrade");

  if (upgrades.length > 0 && downgrades.length > 0) {
    return { label: "Street mixed", tone: "contested", kind: "analyst" };
  }
  if (downgrades.length > 0) {
    return { label: "Analyst downgrade", tone: "negative", kind: "analyst" };
  }
  if (upgrades.some((action) => action.direction === "initiate")) {
    return { label: "Coverage initiated", tone: "positive", kind: "analyst" };
  }
  return { label: "Analyst upgrade", tone: "positive", kind: "analyst" };
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
  // Strip share-class / yahoo suffixes so BTC-USD matches BTC when needed.
  const bare = ticker.replace(/-USD$/i, "");
  const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const bareEscaped = bare.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) return true;
  if (bare !== ticker && new RegExp(`\\b${bareEscaped}\\b`, "i").test(text)) return true;
  const token = companyToken(companyName, ticker);
  if (token && new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
    return true;
  }
  // ETFs / crypto proxies: match common headline language (Bitcoin, S&P 500, …)
  if (matchesMarketInstrumentAlias(text, ticker)) return true;
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
  // Never fall back to unscoped headlines when a ticker is known — that lets
  // market roundups ("Microsoft soars…") leak onto unrelated company cards.
  const scoped = opts.ticker ? relevant : (relevant.length > 0 ? relevant : headlines);

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
  if (theme.includes("street") || theme.includes("analyst")) {
    return { label: "Street focus", tone: "contested", kind: "analyst" };
  }

  return null;
}

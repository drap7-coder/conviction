import type { ConvictionScoreView } from "@/lib/conviction/score/view";
import type { EarningsEvidence } from "@/lib/earnings/types";

export type CompanyDecisionTone = "positive" | "mixed" | "negative" | "quiet";

export interface CompanyDecisionBriefView {
  tone: CompanyDecisionTone;
  status: string;
  headline: string;
  scoreValue: string;
  scoreDetail: string;
  coverageValue: string;
  coverageDetail: string;
  earningsValue: string;
  earningsDetail: string;
  support: string;
  pressure: string;
  nextCheck: string;
  freshness: string;
}

function sentence(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return trimmed;
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function factorLabel(value: string): string {
  return value
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function categoryLabel(value: string): string {
  if (value === "short_interest") return "Short interest";
  return factorLabel(value);
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toneFromScore(score: ConvictionScoreView | null): CompanyDecisionTone {
  if (!score || score.displayScore === null) return "quiet";
  if (score.tone === "green") return "positive";
  if (score.tone === "red") return "negative";
  return "mixed";
}

function clipHeadline(value: string, max = 140): string {
  const trimmed = sentence(value.replace(/\s+/g, " ").trim());
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function headlineFor(
  score: ConvictionScoreView | null,
  earnings: EarningsEvidence | null,
  tape: { label: string; interpretation: string } | null | undefined,
  support: string,
  pressure: string,
): string {
  if (!score || score.displayScore === null) {
    if (earnings?.momentum === "Estimates rising") {
      return "Wall Street estimates are moving up.";
    }
    if (earnings?.momentum === "Estimates falling") {
      return "Estimate revisions have turned down.";
    }
    if (tape?.interpretation && tape.label && tape.label !== "—") {
      return clipHeadline(tape.interpretation);
    }
    return "Still reading price, earnings, and filings.";
  }

  if (earnings?.momentum === "Estimates rising") {
    const latest = earnings.history[0];
    if (latest) {
      return clipHeadline(
        `Estimates are rising after ${latest.fiscalQuarter} ${latest.surprisePercent >= 0 ? "beat" : "missed"} by ${Math.abs(latest.surprisePercent).toFixed(1)}%.`,
      );
    }
    return "Wall Street estimates are moving up.";
  }

  if (earnings?.momentum === "Estimates falling") {
    return "Estimate revisions have turned down — that is the main watch.";
  }

  if (tape?.interpretation && tape.label && tape.label !== "—") {
    return clipHeadline(tape.interpretation);
  }

  if (!support.startsWith("No ")) {
    const detail = support.includes(" — ") ? support.split(" — ").slice(1).join(" — ") : support;
    return clipHeadline(detail);
  }

  if (!pressure.startsWith("No ") && !pressure.includes("not providing")) {
    const detail = pressure.includes(" — ") ? pressure.split(" — ").slice(1).join(" — ") : pressure;
    const normalized = detail.charAt(0).toLowerCase() + detail.slice(1);
    return clipHeadline(`Watch ${normalized}`);
  }

  return "Use the earnings and chart signals below before leaning in.";
}

function strongestSupport(score: ConvictionScoreView | null): string {
  if (!score) return "No source-backed support signal is available yet.";

  const evidence = score.categories
    .filter((item) => item.hasData && !item.isStale && item.score > 0)
    .sort((a, b) => b.score - a.score)[0];
  if (evidence) {
    return `${categoryLabel(evidence.category)} — ${sentence(evidence.explanation)}`;
  }

  const quality = score.qualityFactors
    .filter((item) => item.hasData && item.score > 50)
    .sort((a, b) => b.score - a.score)[0];
  if (quality) {
    return `${factorLabel(quality.factor)} — ${sentence(quality.explanation)}`;
  }

  return "No directional support signal is strong enough to lead the read yet.";
}

function strongestPressure(score: ConvictionScoreView | null): string {
  if (!score) return "The main gap is evidence coverage itself.";

  const pressure = score.categories
    .filter((item) => item.hasData && !item.isStale && item.score < 0)
    .sort((a, b) => a.score - b.score)[0];
  if (pressure) {
    return `${categoryLabel(pressure.category)} — ${sentence(pressure.explanation)}`;
  }

  const missing = score.categories.find((item) => !item.hasData || item.isStale);
  if (missing) {
    return `${categoryLabel(missing.category)} is not providing a fresh directional read yet.`;
  }

  return "No live evidence category is leaning materially against the setup.";
}

function earningsRead(earnings: EarningsEvidence | null): Pick<
  CompanyDecisionBriefView,
  "earningsValue" | "earningsDetail" | "nextCheck" | "freshness"
> {
  if (!earnings || earnings.status === "unavailable") {
    return {
      earningsValue: "Not sourced",
      earningsDetail: "Open the earnings panel below when the feed refreshes.",
      nextCheck: "Next reported quarter or company guidance update.",
      freshness: "Earnings source unavailable",
    };
  }

  const latest = earnings.history[0];
  const nextDate = formatDate(earnings.nextEarningsDate);
  const nextForecast = earnings.forecasts[0];
  const earningsDetail = latest
    ? `${latest.fiscalQuarter}: ${latest.surprisePercent >= 0 ? "beat" : "miss"} by ${Math.abs(latest.surprisePercent).toFixed(1)}%`
    : "No recent surprise history in the current feed.";
  const nextCheck = nextDate
    ? `Next earnings date: ${nextDate}.`
    : nextForecast
      ? `${nextForecast.fiscalQuarter} consensus EPS ${nextForecast.consensusEps.toFixed(2)}; watch the revision balance.`
      : "Next reported quarter or company guidance update.";
  const asOf = formatDate(earnings.asOf);

  return {
    earningsValue: earnings.momentum === "Unavailable" ? "Results on file" : earnings.momentum,
    earningsDetail,
    nextCheck,
    freshness: asOf ? `Earnings evidence through ${asOf}` : "Earnings timing not supplied",
  };
}

export function buildCompanyDecisionBrief(
  score: ConvictionScoreView | null,
  earnings: EarningsEvidence | null,
  tape?: { label: string; interpretation: string } | null,
): CompanyDecisionBriefView {
  const earningsView = earningsRead(earnings);
  const support = strongestSupport(score);
  const pressure = strongestPressure(score);
  const coverage = score?.coverage ?? null;
  const coveragePercent = coverage === null ? null : Math.round(coverage * 100);
  const coverageDetail = coveragePercent === null
    ? "Signal coverage is still being assembled."
    : coveragePercent >= 75
      ? "Most of the weighted evidence stack is live."
      : coveragePercent >= 45
        ? "Useful, but important gaps still limit the read."
        : "Treat the composite as provisional until more inputs arrive.";

  return {
    tone: toneFromScore(score),
    status: score?.ringLabel ?? "Awaiting",
    headline: headlineFor(score, earnings, tape, support, pressure),
    scoreValue: score?.displayScore === null || score?.displayScore === undefined
      ? "—"
      : `${Math.round(score.displayScore)}/100`,
    scoreDetail: score?.blended
      ? `Quality ${score.qualityScore ?? "—"} · evidence ${score.evidenceScore === null ? "—" : `${score.evidenceScore > 0 ? "+" : ""}${score.evidenceScore}`}`
      : score?.evidenceScore === null || score?.evidenceScore === undefined
        ? "Available market evidence only"
        : `Evidence ${score.evidenceScore > 0 ? "+" : ""}${score.evidenceScore}`,
    coverageValue: coveragePercent === null ? "—" : `${coveragePercent}%`,
    coverageDetail,
    earningsValue: earningsView.earningsValue,
    earningsDetail: earningsView.earningsDetail,
    support,
    pressure,
    nextCheck: earningsView.nextCheck,
    freshness: `${earningsView.freshness}${score ? ` · Score model ${score.scoringVersion}` : ""}`,
  };
}

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

function headlineFor(score: ConvictionScoreView | null): string {
  if (!score || score.displayScore === null) {
    return "The evidence stack is still forming. Use the live tape and source panels below before drawing a conclusion.";
  }
  if (score.tone === "green") {
    return "Business quality and live evidence lean constructive; the open risks below are the fastest way to test that read.";
  }
  if (score.tone === "red") {
    return "The evidence stack is leaning defensive. Start with the pressure point and wait for a measurable reversal.";
  }
  return "The setup is contested. No single signal is strong enough to carry the decision on its own.";
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
): CompanyDecisionBriefView {
  const earningsView = earningsRead(earnings);
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
    headline: headlineFor(score),
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
    support: strongestSupport(score),
    pressure: strongestPressure(score),
    nextCheck: earningsView.nextCheck,
    freshness: `${earningsView.freshness}${score ? ` · Score model ${score.scoringVersion}` : ""}`,
  };
}

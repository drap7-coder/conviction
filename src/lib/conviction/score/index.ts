export type {
  CategoryScore,
  ConvictionScoreLabel,
  ConvictionScoreResult,
  EvidenceCategory,
} from "./types";

export {
  CATEGORY_WEIGHTS,
  EVIDENCE_CATEGORIES,
  MIN_COVERAGE,
  SCORING_VERSION,
} from "./weights";

export { labelForScore } from "./labels";

export {
  applyAgreementAdjustment,
  calculateConvictionScore,
  calculateCoverage,
  isUsableCategory,
} from "./calculate";

export {
  STALE_AFTER_DAYS,
  ageInDays,
  clampSignedScore,
  isSourceStale,
} from "./freshness";

export { toInstitutionalCategoryScore } from "./adapters/institutional";
export type { InstitutionalCategoryInput } from "./adapters/institutional";
export { toEarningsCategoryScore } from "./adapters/earnings";
export { toTechnicalsCategoryScore } from "./adapters/technicals";
export type { TechnicalCategoryInput } from "./adapters/technicals";
export { toShortInterestCategoryScore } from "./adapters/short-interest";
export type { ShortInterestCategoryInput } from "./adapters/short-interest";

export {
  buildCategoryScores,
  buildConvictionScore,
  dialValueFromScore,
  displayScoreFromSigned,
  displayLabelForComposite,
  formatCoverageSources,
  toneForComposite,
} from "./build";
export type { BuildConvictionScoreInput, ConvictionDisplayLabel } from "./build";

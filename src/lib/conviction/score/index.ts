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
export type { BuildConvictionScoreInput, ConvictionDisplayLabel, CompositeTone } from "./build";

export {
  getConvictionScoreForTicker,
  getConvictionScoresForTickers,
} from "./get-for-ticker";
export type { ConvictionScoreView } from "./view";
export {
  getCachedConvictionScore,
  setCachedConvictionScore,
  warmConvictionScoreCache,
} from "./cache";

export { calculateQualityComposite } from "./quality/calculate";
export { blendEvidenceAndQuality } from "./quality/blend";
export { buildQualityFactors } from "./quality/factors";
export {
  EVIDENCE_BLEND_WEIGHT,
  QUALITY_BLEND_WEIGHT,
  QUALITY_FACTOR_WEIGHTS,
  QUALITY_MIN_COVERAGE,
} from "./quality/weights";
export type {
  QualityCompositeResult,
  QualityFactorId,
  QualityFactorScore,
} from "./quality/types";
export type { BlendedConvictionScore } from "./quality/blend";

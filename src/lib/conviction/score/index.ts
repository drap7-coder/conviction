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

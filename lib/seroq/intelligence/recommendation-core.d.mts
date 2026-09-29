export type RecommendationLabel =
  | "PRIMARY_RECOMMENDATION"
  | "SHORTLISTED"
  | "ORDINARY_MENTION"
  | "COMPARISON_OR_QUALIFIED"
  | "CAUTIONARY"
  | "NEGATIVE"
  | "ABSENT"
  | "UNCLASSIFIED";

export type RecommendationConfidence =
  | "HIGH"
  | "MEDIUM"
  | "LOW"
  | "NONE";

export interface RecommendationInput {
  targetBrand: string;
  queryText: string;
  responseText: string;
}

export interface RecommendationVerdict {
  label: RecommendationLabel;
  confidence: RecommendationConfidence;
  evidence: string;
  method: "DETERMINISTIC_V1";
}

export const RECOMMENDATION_LABELS:
  readonly RecommendationLabel[];

export function classifyRecommendation(
  input: RecommendationInput,
): RecommendationVerdict;

/**
 * Seroq Observation Schema v2
 *
 * Design rules:
 * - raw evidence is never destroyed
 * - missing is never converted to zero
 * - deterministic observations are separated from inference
 * - mentions, citations and recommendations are different concepts
 * - every denominator is explicit
 */

export type EvidenceLevel =
  | "OBSERVED"
  | "VERIFIED"
  | "INFERRED"
  | "UNKNOWN";


export type SeroqProvider =
  | "chatgpt"
  | "perplexity"
  | "gemini"
  | "claude"
  | "ai-overview"
  | string;


export type VisibilityState =
  | "full_visibility"
  | "mention_only"
  | "citation_only"
  | "third_party_mention"
  | "invisible"
  | "unknown";


export type RecommendationRole =
  | "primary_recommendation"
  | "shortlisted"
  | "ordinary_mention"
  | "comparison_or_qualified"
  | "cautionary"
  | "negative"
  | "source_only"
  | "absent"
  | "unclassified";


export type SourceCategory =
  | "owned"
  | "competitor_owned"
  | "review_aggregator"
  | "editorial_news"
  | "community_social"
  | "reference"
  | "other";


export type RawCitation = {
  url?: string;
  title?: string | null;
  domain?: string;
};


export type NormalizedCitation = {
  url: string;
  domain: string;
  title: string | null;

  position: number;

  category: SourceCategory;

  evidenceLevel: "OBSERVED";
};


export type BrandEntity = {
  canonicalName: string;

  aliases: string[];

  domain?: string;

  isTarget: boolean;
};


export type BrandMention = {
  canonicalName: string;

  matchedText: string;

  count: number;

  firstCharacterPosition: number | null;

  isTarget: boolean;

  evidenceLevel: "OBSERVED";
};


export type ObservationInput = {
  observationId: string;

  queryId: string;
  queryText: string;

  provider: SeroqProvider;

  capturedAt: string;

  responseText: string;

  citations: RawCitation[];

  target: BrandEntity;

  competitors: BrandEntity[];
};


export type ObservationV2 = {
  schemaVersion: 2;

  observationId: string;

  queryId: string;
  queryText: string;

  provider: SeroqProvider;

  capturedAt: string;

  status:
    | "VALID"
    | "UNKNOWN";

  rawResponse: string;

  target: {
    canonicalName: string;

    mentioned: boolean;

    mentionCount: number;

    firstCharacterPosition:
      | number
      | null;

    ownDomainCited: boolean;

    visibilityState: VisibilityState;

    recommendationRole: RecommendationRole;

    recommendationEvidenceLevel:
      | "OBSERVED"
      | "INFERRED"
      | "UNKNOWN";
  };

  mentions: BrandMention[];

  citations: NormalizedCitation[];

  evidence: {
    deterministicExtraction:
      true;

    semanticClassification:
      false;

    evidenceLevel:
      "OBSERVED";
  };
};


export type UnknownObservationV2 = {
  schemaVersion: 2;

  observationId: string;

  queryId: string;
  queryText: string;

  provider: SeroqProvider;

  capturedAt: string;

  status: "UNKNOWN";

  error: string;

  evidenceLevel: "UNKNOWN";
};


export type EngineMetrics = {
  provider: SeroqProvider;

  expectedObservations: number;

  validObservations: number;

  unknownObservations: number;

  coverageRate:
    | number
    | null;

  targetMentionObservations: number;

  mentionRate:
    | number
    | null;

  targetCitationObservations: number;

  citationRate:
    | number
    | null;
};


export type JourneyMetrics = {
  queryId: string;

  queryText: string;

  expectedObservations: number;

  validObservations: number;

  unknownObservations: number;

  coverageRate:
    | number
    | null;

  targetMentionObservations: number;

  mentionRate:
    | number
    | null;

  targetCitationObservations: number;

  citationRate:
    | number
    | null;
};


export type CompetitorMetric = {
  name: string;

  observedMentionCount: number;

  observationCount: number;

  mentionRate:
    | number
    | null;

  firstMentionCount: number;

  evidenceLevel: "OBSERVED";
};


export type SourceMetric = {
  domain: string;

  category: SourceCategory;

  citationCount: number;

  observationCount: number;

  queryCount: number;

  engineCount: number;

  evidenceLevel: "OBSERVED";
};


export type IntelligenceSummaryV2 = {
  schemaVersion: 2;

  generatedAt: string;

  targetBrand: string;

  intendedObservations: number;

  validObservations: number;

  unknownObservations: number;

  measurementCoverage:
    | number
    | null;

  targetMentionObservations: number;

  targetMentionRate:
    | number
    | null;

  targetCitationObservations: number;

  targetCitationRate:
    | number
    | null;

  engineMetrics: EngineMetrics[];

  journeyMetrics: JourneyMetrics[];

  competitors: CompetitorMetric[];

  sources: SourceMetric[];

  visibilityStateMix: Record<
    VisibilityState,
    number
  >;

  methodology: {
    missingDataRule:
      "UNKNOWN_EXCLUDED_FROM_PERFORMANCE_DENOMINATORS";

    aggregationRule:
      "VALID_OBSERVATIONS_ONLY";

    coverageRule:
      "VALID_DIVIDED_BY_INTENDED";

    competitorRule:
      "ONLY_CONFIGURED_COMPETITORS_ARE_DETERMINISTICALLY_COUNTED";

    recommendationRule:
      "NOT_YET_SEMANTICALLY_CLASSIFIED";
  };
};

import type {
  CompetitorMetric,
  EngineMetrics,
  IntelligenceSummaryV2,
  JourneyMetrics,
  ObservationV2,
  SourceMetric,
  UnknownObservationV2,
  VisibilityState,
} from "./types";


type AnyObservation =
  | ObservationV2
  | UnknownObservationV2;


function rate(
  numerator: number,

  denominator: number,
): number | null {

  if (
    denominator <=
    0
  ) {

    return null;

  }


  return (
    numerator /
    denominator
  );

}


const VISIBILITY_STATES:
  VisibilityState[] = [
    "full_visibility",
    "mention_only",
    "citation_only",
    "third_party_mention",
    "invisible",
    "unknown",
  ];


export function buildIntelligenceSummary(
  observations: AnyObservation[],

  options: {
    targetBrand: string;

    expectedProviders: string[];

    queryIds: string[];

    repetitionsPerProviderQuery: number;
  },
): IntelligenceSummaryV2 {

  const valid =
    observations.filter(
      (
        observation,
      ): observation is ObservationV2 =>
        observation.status ===
        "VALID",
    );


  const unknown =
    observations.filter(
      (
        observation,
      ): observation is UnknownObservationV2 =>
        observation.status ===
        "UNKNOWN",
    );


  const intendedObservations =
    options.expectedProviders.length *
    options.queryIds.length *
    options.repetitionsPerProviderQuery;


  const targetMentionObservations =
    valid.filter(
      (
        observation,
      ) =>
        observation.target
          .mentioned,
    ).length;


  const targetCitationObservations =
    valid.filter(
      (
        observation,
      ) =>
        observation.target
          .ownDomainCited,
    ).length;


  const engineMetrics:
    EngineMetrics[] =
    options.expectedProviders.map(
      (
        provider,
      ) => {

        const providerValid =
          valid.filter(
            (
              observation,
            ) =>
              observation.provider ===
              provider,
          );


        const providerUnknown =
          unknown.filter(
            (
              observation,
            ) =>
              observation.provider ===
              provider,
          );


        const expected =
          options.queryIds.length *
          options.repetitionsPerProviderQuery;


        const mentions =
          providerValid.filter(
            (
              observation,
            ) =>
              observation.target
                .mentioned,
          ).length;


        const citations =
          providerValid.filter(
            (
              observation,
            ) =>
              observation.target
                .ownDomainCited,
          ).length;


        return {

          provider,

          expectedObservations:
            expected,

          validObservations:
            providerValid.length,

          unknownObservations:
            providerUnknown.length,

          coverageRate:
            rate(
              providerValid.length,
              expected,
            ),

          targetMentionObservations:
            mentions,

          mentionRate:
            rate(
              mentions,
              providerValid.length,
            ),

          targetCitationObservations:
            citations,

          citationRate:
            rate(
              citations,
              providerValid.length,
            ),

        };

      },
    );


  const journeyMetrics:
    JourneyMetrics[] =
    options.queryIds.map(
      (
        queryId,
      ) => {

        const journeyValid =
          valid.filter(
            (
              observation,
            ) =>
              observation.queryId ===
              queryId,
          );


        const journeyUnknown =
          unknown.filter(
            (
              observation,
            ) =>
              observation.queryId ===
              queryId,
          );


        const expected =
          options.expectedProviders.length *
          options.repetitionsPerProviderQuery;


        const mentions =
          journeyValid.filter(
            (
              observation,
            ) =>
              observation.target
                .mentioned,
          ).length;


        const citations =
          journeyValid.filter(
            (
              observation,
            ) =>
              observation.target
                .ownDomainCited,
          ).length;


        return {

          queryId,

          queryText:
            journeyValid[0]
              ?.queryText ??
            journeyUnknown[0]
              ?.queryText ??
            queryId,

          expectedObservations:
            expected,

          validObservations:
            journeyValid.length,

          unknownObservations:
            journeyUnknown.length,

          coverageRate:
            rate(
              journeyValid.length,
              expected,
            ),

          targetMentionObservations:
            mentions,

          mentionRate:
            rate(
              mentions,
              journeyValid.length,
            ),

          targetCitationObservations:
            citations,

          citationRate:
            rate(
              citations,
              journeyValid.length,
            ),

        };

      },
    );


  const competitorMap =
    new Map<
      string,
      {
        observations:
          Set<string>;

        mentionCount:
          number;

        firstMentionCount:
          number;
      }
    >();


  for (
    const observation of
      valid
  ) {

    const nonTargetMentions =
      observation.mentions.filter(
        (
          mention,
        ) =>
          !mention.isTarget,
      );


    const first =
      [...nonTargetMentions]
        .filter(
          (
            mention,
          ) =>
            mention.firstCharacterPosition !==
            null,
        )
        .sort(
          (
            a,
            b,
          ) =>
            (
              a.firstCharacterPosition ??
              Number.MAX_SAFE_INTEGER
            ) -
            (
              b.firstCharacterPosition ??
              Number.MAX_SAFE_INTEGER
            ),
        )[0];


    for (
      const mention of
        nonTargetMentions
    ) {

      const current =
        competitorMap.get(
          mention.canonicalName,
        ) ?? {

          observations:
            new Set<string>(),

          mentionCount:
            0,

          firstMentionCount:
            0,

        };


      current.observations.add(
        observation.observationId,
      );


      current.mentionCount +=
        mention.count;


      if (
        first?.canonicalName ===
        mention.canonicalName
      ) {

        current.firstMentionCount +=
          1;

      }


      competitorMap.set(
        mention.canonicalName,
        current,
      );

    }

  }


  const competitors:
    CompetitorMetric[] =
    [
      ...competitorMap.entries(),
    ]
      .map(
        (
          [
            name,
            value,
          ],
        ) => ({

          name,

          observedMentionCount:
            value.mentionCount,

          observationCount:
            value.observations.size,

          mentionRate:
            rate(
              value.observations.size,
              valid.length,
            ),

          firstMentionCount:
            value.firstMentionCount,

          evidenceLevel:
            "OBSERVED" as const,

        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.observationCount -
            a.observationCount ||
          b.observedMentionCount -
            a.observedMentionCount ||
          a.name.localeCompare(
            b.name,
          ),
      );


  const sourceMap =
    new Map<
      string,
      {
        category:
          SourceMetric["category"];

        citations:
          number;

        observations:
          Set<string>;

        queries:
          Set<string>;

        engines:
          Set<string>;
      }
    >();


  for (
    const observation of
      valid
  ) {

    for (
      const citation of
        observation.citations
    ) {

      const current =
        sourceMap.get(
          citation.domain,
        ) ?? {

          category:
            citation.category,

          citations:
            0,

          observations:
            new Set<string>(),

          queries:
            new Set<string>(),

          engines:
            new Set<string>(),

        };


      current.citations +=
        1;


      current.observations.add(
        observation.observationId,
      );


      current.queries.add(
        observation.queryId,
      );


      current.engines.add(
        observation.provider,
      );


      sourceMap.set(
        citation.domain,
        current,
      );

    }

  }


  const sources:
    SourceMetric[] =
    [
      ...sourceMap.entries(),
    ]
      .map(
        (
          [
            domain,
            value,
          ],
        ) => ({

          domain,

          category:
            value.category,

          citationCount:
            value.citations,

          observationCount:
            value.observations.size,

          queryCount:
            value.queries.size,

          engineCount:
            value.engines.size,

          evidenceLevel:
            "OBSERVED" as const,

        }),
      )
      .sort(
        (
          a,
          b,
        ) =>
          b.observationCount -
            a.observationCount ||
          b.engineCount -
            a.engineCount ||
          b.queryCount -
            a.queryCount ||
          b.citationCount -
            a.citationCount ||
          a.domain.localeCompare(
            b.domain,
          ),
      );


  const visibilityStateMix =
    Object.fromEntries(
      VISIBILITY_STATES.map(
        (
          state,
        ) => [

          state,

          state ===
          "unknown"
            ? unknown.length
            : valid.filter(
                (
                  observation,
                ) =>
                  observation.target
                    .visibilityState ===
                  state,
              ).length,

        ],
      ),
    ) as Record<
      VisibilityState,
      number
    >;


  return {

    schemaVersion:
      2,

    generatedAt:
      new Date()
        .toISOString(),

    targetBrand:
      options.targetBrand,

    intendedObservations,

    validObservations:
      valid.length,

    unknownObservations:
      unknown.length,

    measurementCoverage:
      rate(
        valid.length,
        intendedObservations,
      ),

    targetMentionObservations,

    targetMentionRate:
      rate(
        targetMentionObservations,
        valid.length,
      ),

    targetCitationObservations,

    targetCitationRate:
      rate(
        targetCitationObservations,
        valid.length,
      ),

    engineMetrics,

    journeyMetrics,

    competitors,

    sources,

    visibilityStateMix,

    methodology: {

      missingDataRule:
        "UNKNOWN_EXCLUDED_FROM_PERFORMANCE_DENOMINATORS",

      aggregationRule:
        "VALID_OBSERVATIONS_ONLY",

      coverageRule:
        "VALID_DIVIDED_BY_INTENDED",

      competitorRule:
        "ONLY_CONFIGURED_COMPETITORS_ARE_DETERMINISTICALLY_COUNTED",

      recommendationRule:
        "NOT_YET_SEMANTICALLY_CLASSIFIED",

    },

  };

}

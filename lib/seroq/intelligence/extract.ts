import {
  classifySource,
  domainMatches,
  normalizeDomain,
  normalizeUrl,
} from "./normalize";

import type {
  BrandEntity,
  BrandMention,
  NormalizedCitation,
  ObservationInput,
  ObservationV2,
  VisibilityState,
} from "./types";


function escapedRegex(
  value: string,
): string {

  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );

}


function entityNames(
  entity: BrandEntity,
): string[] {

  return [
    entity.canonicalName,
    ...entity.aliases,
  ]
    .map(
      (
        value,
      ) =>
        String(
          value ??
          "",
        ).trim(),
    )
    .filter(
      (
        value,
      ) =>
        value.length >=
        2,
    )
    .filter(
      (
        value,
        index,
        all,
      ) =>
        all.findIndex(
          (
            item,
          ) =>
            item.toLowerCase() ===
            value.toLowerCase(),
        ) === index,
    );

}


function detectEntityMention(
  responseText: string,

  entity: BrandEntity,
): BrandMention | null {

  let count =
    0;

  let firstPosition:
    number |
    null =
    null;

  let matchedText =
    "";


  for (
    const name of
      entityNames(
        entity,
      )
  ) {

    /*
     * Conservative textual match:
     * do not count substrings embedded inside ordinary words.
     *
     * Example:
     * "Kit" should not match "toolkit".
     */
    const regex =
      new RegExp(
        `(^|[^\\p{L}\\p{N}])(${escapedRegex(name)})(?=$|[^\\p{L}\\p{N}])`,
        "giu",
      );


    for (
      const match of
        responseText.matchAll(
          regex,
        )
    ) {

      count +=
        1;


      const prefixLength =
        match[1]?.length ??
        0;


      const position =
        (
          match.index ??
          0
        ) +
        prefixLength;


      if (
        firstPosition ===
          null ||
        position <
          firstPosition
      ) {

        firstPosition =
          position;

        matchedText =
          match[2] ??
          name;

      }

    }

  }


  if (
    count ===
    0
  ) {

    return null;

  }


  return {

    canonicalName:
      entity.canonicalName,

    matchedText,

    count,

    firstCharacterPosition:
      firstPosition,

    isTarget:
      entity.isTarget,

    evidenceLevel:
      "OBSERVED",

  };

}


function normalizeCitations(
  input: ObservationInput,
): NormalizedCitation[] {

  const competitorDomains =
    input.competitors
      .map(
        (
          competitor,
        ) =>
          normalizeDomain(
            competitor.domain,
          ),
      )
      .filter(
        Boolean,
      );


  const seen =
    new Set<string>();


  const output:
    NormalizedCitation[] =
    [];


  input.citations.forEach(
    (
      citation,
      index,
    ) => {

      const url =
        normalizeUrl(
          citation.url,
        );


      const domain =
        normalizeDomain(
          citation.domain ||
          url,
        );


      if (
        !domain
      ) {

        return;

      }


      const key =
        url ||
        `${domain}#${index}`;


      if (
        seen.has(
          key,
        )
      ) {

        return;

      }


      seen.add(
        key,
      );


      output.push({

        url,

        domain,

        title:
          citation.title ??
          null,

        position:
          output.length +
          1,

        category:
          classifySource(
            domain,
            input.target.domain,
            competitorDomains,
          ),

        evidenceLevel:
          "OBSERVED",

      });

    },
  );


  return output;

}


function deriveVisibilityState(
  targetMentioned: boolean,

  targetDomainCited: boolean,
): VisibilityState {

  if (
    targetMentioned &&
    targetDomainCited
  ) {

    return "full_visibility";

  }


  if (
    targetMentioned
  ) {

    return "mention_only";

  }


  if (
    targetDomainCited
  ) {

    return "citation_only";

  }


  return "invisible";

}


export function extractObservation(
  input: ObservationInput,
): ObservationV2 {

  const entities =
    [
      input.target,
      ...input.competitors,
    ];


  const mentions =
    entities
      .map(
        (
          entity,
        ) =>
          detectEntityMention(
            input.responseText,
            entity,
          ),
      )
      .filter(
        (
          mention,
        ): mention is BrandMention =>
          mention !==
          null,
      );


  const targetMention =
    mentions.find(
      (
        mention,
      ) =>
        mention.isTarget,
    ) ??
    null;


  const citations =
    normalizeCitations(
      input,
    );


  const targetDomainCited =
    Boolean(
      input.target.domain,
    ) &&
    citations.some(
      (
        citation,
      ) =>
        domainMatches(
          citation.domain,
          input.target.domain,
        ),
    );


  const visibilityState =
    deriveVisibilityState(
      Boolean(
        targetMention,
      ),

      targetDomainCited,
    );


  return {

    schemaVersion:
      2,

    observationId:
      input.observationId,

    queryId:
      input.queryId,

    queryText:
      input.queryText,

    provider:
      input.provider,

    capturedAt:
      input.capturedAt,

    status:
      "VALID",

    rawResponse:
      input.responseText,

    target: {

      canonicalName:
        input.target
          .canonicalName,

      mentioned:
        Boolean(
          targetMention,
        ),

      mentionCount:
        targetMention?.count ??
        0,

      firstCharacterPosition:
        targetMention
          ?.firstCharacterPosition ??
        null,

      ownDomainCited:
        targetDomainCited,

      visibilityState,

      /*
       * Recommendation is deliberately NOT guessed from a string match.
       * A semantic classifier will populate this in Intelligence Phase 2.
       */
      recommendationRole:
        targetMention
          ? "unclassified"
          : targetDomainCited
            ? "source_only"
            : "absent",

      recommendationEvidenceLevel:
        targetMention
          ? "UNKNOWN"
          : "OBSERVED",

    },

    mentions,

    citations,

    evidence: {

      deterministicExtraction:
        true,

      semanticClassification:
        false,

      evidenceLevel:
        "OBSERVED",

    },

  };

}

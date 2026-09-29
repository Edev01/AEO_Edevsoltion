import {
  buildCompetitiveDigest,
} from "./seroq-competitive";

import {
  findProofProfile,
  getProofSnapshot,
  type BrandProofProfile,
  type ProofDimension,
} from "./seroq-proof-verifier";


export type WhyGap = {

  dimension:
    ProofDimension;

  competitorSupport:
    number;

  recurringCompetitors:
    string[];

  targetEvidenceFound:
    boolean;

  status:
    "INFERRED";

  explanation:
    string;

};


export type SeroqWhyPacket = {

  generatedAt:
    string;

  buyerJourney:
    string;

  targetBrand:
    string;


  observations: {

    status:
      "OBSERVED";

    validTrials:
      number;

    targetMentions:
      number;

    recurringCompetitors:
      Array<{
        name:
          string;

        mentions:
          number;

        rate:
          number;
      }>;

  };


  evidence: {

    status:
      "VERIFIED";

    generatedAt:
      string;

    methodology:
      string;

    target:
      BrandProofProfile | null;

    competitors:
      BrandProofProfile[];

  };


  gaps:
    WhyGap[];


  inference: {

    status:
      "INFERRED";

    statement:
      string;

    limitation:
      string;

  };


  action: {

    title:
      string;

    priority:
      "high";

    reason:
      string;

    workPackage:
      string[];

    validation:
      string;

  };


  baseline: {

    capturedAt:
      string;

    provider:
      string;

    validTrials:
      number;

    targetMentions:
      number;

    presenceRate:
      number;

  };

};



const DIMENSIONS:
  ProofDimension[] = [

    "agentic-workflows",

    "hitl-controls",

    "evaluation-system",

    "governance-audit",

    "production-operations",

    "vendor-portability",

  ];



export async function buildWhyPacket(): Promise<
  SeroqWhyPacket | null
> {

  const competitive =
    await buildCompetitiveDigest();


  if (!competitive) {
    return null;
  }


  /*
   * Cached for 24 hours.
   *
   * Failed URL fetches remain UNKNOWN.
   * They are never converted into
   * "evidence not present".
   */
  const proofSnapshot =
    await getProofSnapshot(
      false,
    );


  const target =
    findProofProfile(
      proofSnapshot,
      competitive.targetBrand,
    );


  const competitorProfiles =
    competitive
      .recurringCompetitors
      .map(
        (competitor) =>
          findProofProfile(
            proofSnapshot,
            competitor.name,
          ),
      )
      .filter(
        (
          profile,
        ): profile is BrandProofProfile =>
          Boolean(profile),
      );


  const targetReviewUsable =
    Boolean(
      target &&
      target
        .successfullyReviewedSources >
        0,
    );


  const targetDimensions =
    new Set(
      target?.proofs.map(
        (proof) =>
          proof.dimension,
      ) ??
      [],
    );


  const gaps:
    WhyGap[] = [];


  /*
   * IMPORTANT:
   *
   * We infer a proof-pattern gap only when:
   *
   * 1. at least one target page actually fetched;
   * 2. at least TWO recurring competitors have
   *    VERIFIED evidence for the dimension;
   * 3. that dimension was not found in the
   *    successfully reviewed target material.
   *
   * A failed target fetch can therefore NEVER
   * become a competitive gap.
   */
  if (
    targetReviewUsable
  ) {

    for (
      const dimension of
        DIMENSIONS
    ) {

      const supporting =
        competitorProfiles
          .filter(
            (profile) =>
              profile
                .successfullyReviewedSources >
                0 &&
              profile.proofs.some(
                (proof) =>
                  proof.dimension ===
                  dimension,
              ),
          )
          .map(
            (profile) =>
              profile.brand,
          );


      const targetEvidenceFound =
        targetDimensions.has(
          dimension,
        );


      if (
        supporting.length >=
          2 &&
        !targetEvidenceFound
      ) {

        gaps.push({

          dimension,

          competitorSupport:
            supporting.length,

          recurringCompetitors:
            supporting,

          targetEvidenceFound:
            false,

          status:
            "INFERRED",

          explanation:
            `${supporting.length} recurring competitors expose explicit ${dimension} evidence in successfully fetched official material; the same evidence type was not found in the target pages Seroq successfully reviewed.`,

        });

      }

    }

  }


  const targetFetchFailures =
    target?.failedSources ??
    0;


  const evidenceLimitation =
    !targetReviewUsable
      ? "Target proof pages could not be verified reliably, so Seroq will not infer a proof deficit from missing evidence."
      : targetFetchFailures >
          0
        ? `${targetFetchFailures} target source fetch failed and remains UNKNOWN; absence conclusions apply only to successfully reviewed target pages.`
        : "Evidence-gap conclusions apply only to the official pages reviewed by this verification pass.";


  const packet:
    SeroqWhyPacket = {

    generatedAt:
      new Date()
        .toISOString(),


    buyerJourney:
      competitive.prompt,


    targetBrand:
      competitive.targetBrand,


    observations: {

      status:
        "OBSERVED",

      validTrials:
        competitive.validTrials,

      targetMentions:
        competitive.target
          .mentions,

      recurringCompetitors:
        competitive
          .recurringCompetitors
          .map(
            (
              competitor,
            ) => ({

              name:
                competitor.name,

              mentions:
                competitor.mentions,

              rate:
                competitor.rate,

            }),
          ),

    },


    evidence: {

      status:
        "VERIFIED",

      generatedAt:
        proofSnapshot
          .generatedAt,

      methodology:
        proofSnapshot
          .methodology,

      target,

      competitors:
        competitorProfiles,

    },


    gaps,


    inference: {

      status:
        "INFERRED",

      statement:
        gaps.length >
        0
          ? "The reviewed evidence shows recurring competitors exposing buyer-relevant proof patterns that were not found in the successfully reviewed target material. This is a plausible, addressable contributor to the observed recommendation gap."
          : targetReviewUsable
            ? "The current verified evidence does not support a strong proof-pattern gap under Seroq's recurrence threshold."
            : "Seroq does not have enough verified target evidence to infer why the recommendation gap exists.",

      limitation:
        `Public-evidence differences do not establish causation. ${evidenceLimitation} Generative recommendations are stochastic and the model's internal retrieval and reasoning path is not directly observable.`,

    },


    action: {

      title:
        "Publish a buyer-matched agentic AI proof asset",

      priority:
        "high",

      reason:
        gaps.some(
          (gap) =>
            gap.dimension ===
            "hitl-controls",
        )
          ? "Human-control evidence recurs among measured winners but was not found in the successfully reviewed target material."
          : gaps.length >
              0
            ? "Recurring winners expose public proof patterns that the reviewed target material does not currently make explicit."
            : "Before prescribing a specific proof intervention, collect additional target and competitor evidence.",


      workPackage: [

        "Select one real agentic AI engagement with permission to publish implementation evidence.",

        "Document the actual workflow architecture, model/tool boundaries, data/context layer and production environment.",

        "Document human approval boundaries only where they genuinely exist: read actions, low-risk writes, consequential writes and irreversible actions.",

        "Expose the real evaluation system: offline evaluations, regression checks, adversarial cases, production monitoring, task-success metrics, overrides, latency and cost where available.",

        "Document deterministic permissions, governance and auditability outside the model wherever those controls genuinely exist.",

        "State model/provider portability only where the delivered architecture actually supports it.",

        "Add substantiated implementation outcomes. Never fabricate customer names, performance improvements or governance controls.",

        "Pursue independent corroboration where possible so important claims are not supported only by first-party marketing.",

      ],


      validation:
        "After the evidence asset is published and discoverable, rerun the identical buyer journey through the same consumer-UI instrument using repeated samples. Compare against this baseline without claiming that any observed movement was caused by the intervention alone.",

    },


    baseline: {

      capturedAt:
        competitive.generatedAt,

      provider:
        competitive.provider,

      validTrials:
        competitive.validTrials,

      targetMentions:
        competitive.target
          .mentions,

      presenceRate:
        competitive.target
          .rate,

    },

  };


  return packet;

}

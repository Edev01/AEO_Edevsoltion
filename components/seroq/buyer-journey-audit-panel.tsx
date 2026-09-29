"use client";

import {
  useState,
} from "react";

import type {
  ScrapeRun,
  TaggedPrompt,
} from "@/components/dashboard/types";


type AuditTrial = {
  capturedAt: string;
  targetMentioned: boolean;
  response: string;
  sources: unknown[];
};


type AuditResult = {
  queryId: string;
  queryText: string;
  tags: string[];

  status:
    "OBSERVED" |
    "UNKNOWN";

  validTrials: number;
  failedTrials: number;

  presence: {
    hits: number;
    n: number;
    rate: number;

    confidenceInterval: {
      level: number;
      method: string;
      low: number;
      high: number;
    };
  } | null;

  trials: AuditTrial[];

  error?: string;
};


type AuditResponse = {
  batchId: string;

  targetBrand: string;

  samplesPerJourney: number;

  results: AuditResult[];

  failedJourneyCount: number;

  overall: {
    status:
      "OBSERVED" |
      "UNKNOWN";

    hits: number;
    n: number;

    rate:
      number | null;

    confidenceInterval: {
      low: number;
      high: number;
    } | null;
  };
};


function sourceUrl(
  source: unknown,
): string | null {

  if (
    typeof source ===
    "string"
  ) {
    return source;
  }


  if (
    source &&
    typeof source ===
      "object"
  ) {

    const record =
      source as Record<
        string,
        unknown
      >;


    for (
      const key of [
        "url",
        "href",
        "link",
      ]
    ) {

      if (
        typeof record[key] ===
        "string"
      ) {
        return record[key] as string;
      }

    }

  }


  return null;
}


function percent(
  value:
    number | null,
): string {

  if (
    value ===
    null
  ) {
    return "UNKNOWN";
  }


  return `${(
    value * 100
  ).toFixed(1)}%`;

}


export function BuyerJourneyAuditPanel({
  brandName,
  prompts,
  onImportRuns,
}: {

  brandName:
    string;

  prompts:
    TaggedPrompt[];

  onImportRuns:
    (
      runs:
        ScrapeRun[],
    ) => void;

}) {

  const [
    journeyCount,
    setJourneyCount,
  ] =
    useState(
      3,
    );


  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );


  const [
    audit,
    setAudit,
  ] =
    useState<AuditResponse | null>(
      null,
    );


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );


  async function runAudit() {

    if (
      !brandName.trim()
    ) {

      setError(
        "Analyze a customer website first so Seroq knows the target brand.",
      );

      return;
    }


    if (
      prompts.length ===
      0
    ) {

      setError(
        "No buyer journeys exist yet. Analyze the website first.",
      );

      return;
    }


    setBusy(
      true,
    );

    setError(
      null,
    );


    try {

      const response =
        await fetch(
          "/api/seroq/buyer-audit",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({

                targetBrand:
                  brandName,

                prompts,

                maxJourneys:
                  journeyCount,

              }),
          },
        );


      const data =
        await response.json();


      if (
        !response.ok ||
        !data.ok
      ) {

        throw new Error(
          data.error ??
            "Buyer journey audit failed.",
        );

      }


      const result =
        data as AuditResponse;


      setAudit(
        result,
      );


      const imported:
        ScrapeRun[] = [];


      for (
        const journey of
          result.results
      ) {

        for (
          const trial of
            journey.trials
        ) {

          imported.push({

            provider:
              "chatgpt",

            prompt:
              journey.queryText,

            answer:
              trial.response,

            sources:
              trial.sources
                .map(
                  sourceUrl,
                )
                .filter(
                  (
                    value,
                  ): value is string =>
                    Boolean(
                      value,
                    ),
                ),

            createdAt:
              trial.capturedAt,

            /*
             * Legacy donor field.
             * Seroq's customer-facing metric is presence frequency,
             * not this legacy score.
             */
            visibilityScore:
              trial.targetMentioned
                ? 100
                : 0,

            sentiment:
              trial.targetMentioned
                ? "neutral"
                : "not-mentioned",

            brandMentions:
              trial.targetMentioned
                ? [
                    brandName,
                  ]
                : [],

            competitorMentions:
              [],

          });

        }

      }


      if (
        imported.length >
        0
      ) {

        onImportRuns(
          imported,
        );

      }

    }
    catch (
      caught
    ) {

      setError(
        caught instanceof Error
          ? caught.message
          : String(
              caught,
            ),
      );

    }
    finally {

      setBusy(
        false,
      );

    }

  }


  if (
    !brandName &&
    prompts.length ===
      0
  ) {
    return null;
  }


  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e11]">

      <div className="border-b border-white/10 px-6 py-6 sm:px-7">

        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
          Live buyer audit
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
          Ask the questions customers actually ask.
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Each selected buyer journey is asked five times through the logged-in consumer AI answer interface. Failed trials remain unknown and are excluded from presence denominators.
        </p>


        <div className="mt-5 flex flex-wrap items-center gap-3">

          <select
            value={
              journeyCount
            }
            disabled={
              busy
            }
            onChange={
              (
                event,
              ) =>
                setJourneyCount(
                  Number(
                    event.target.value,
                  ),
                )
            }
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-300"
          >
            <option value={3}>
              Quick scan — 3 journeys / multi-AI
            </option>

            <option value={5}>
              Standard — 5 journeys / multi-AI
            </option>

            <option value={10}>
              Full — 10 journeys / multi-AI
            </option>
          </select>


          <button
            type="button"
            disabled={
              busy ||
              !brandName ||
              prompts.length ===
                0
            }
            onClick={
              () =>
                void runAudit()
            }
            className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-5 py-2.5 text-sm font-medium text-emerald-100 disabled:cursor-wait disabled:opacity-40"
          >
            {
              busy
                ? "Running live AI trials…"
                : "Run live measurement"
            }
          </button>

        </div>


        {
          busy
            ? (
              <p className="mt-3 text-xs text-zinc-600">
                Keep this page open. The scan is running sequentially to avoid mixing sessions and evidence.
              </p>
            )
            : null
        }


        {
          error
            ? (
              <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[0.04] p-4 text-sm text-red-200">
                {error}
              </div>
            )
            : null
        }

      </div>


      {
        audit
          ? (

            <div className="px-6 py-6 sm:px-7">

              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">

                <div className="text-sm text-zinc-500">
                  Measurement complete. Client report is ready.
                </div>

                <a
                  href="/report"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-2.5 text-sm font-medium text-emerald-100"
                >
                  Open Client Report
                </a>

              </div>

              <div className="grid gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-4">

                <Metric
                  label="Observed presence"
                  value={
                    audit.overall.status ===
                    "OBSERVED"
                      ? `${audit.overall.hits}/${audit.overall.n}`
                      : "UNKNOWN"
                  }
                />

                <Metric
                  label="Presence rate"
                  value={
                    percent(
                      audit.overall.rate,
                    )
                  }
                />

                <Metric
                  label="Buyer journeys"
                  value={
                    String(
                      audit.results.length,
                    )
                  }
                />

                <Metric
                  label="Unknown journeys"
                  value={
                    String(
                      audit.failedJourneyCount,
                    )
                  }
                />

              </div>


              {
                audit.overall
                  .confidenceInterval
                  ? (

                    <div className="mt-3 text-xs text-zinc-600">
                      95% Wilson interval:{" "}
                      {
                        percent(
                          audit.overall
                            .confidenceInterval
                            .low,
                        )
                      }
                      {" – "}
                      {
                        percent(
                          audit.overall
                            .confidenceInterval
                            .high,
                        )
                      }
                    </div>

                  )
                  : null
              }


              <div className="mt-5 grid gap-3">

                {
                  audit.results.map(
                    (
                      result,
                    ) => (

                      <div
                        key={
                          result.queryId
                        }
                        className="rounded-xl border border-white/10 bg-black/20 p-4"
                      >

                        <div className="flex flex-wrap items-start justify-between gap-4">

                          <div className="max-w-3xl">

                            <div className="text-sm font-medium leading-6 text-zinc-200">
                              {
                                result.queryText
                              }
                            </div>

                            <div className="mt-2 flex flex-wrap gap-1.5">

                              {
                                result.tags.map(
                                  (
                                    tag,
                                  ) => (

                                    <span
                                      key={
                                        tag
                                      }
                                      className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-zinc-600"
                                    >
                                      {tag}
                                    </span>

                                  ),
                                )
                              }

                            </div>

                          </div>


                          <div className="text-right">

                            <div className="text-lg font-semibold text-zinc-100">

                              {
                                result.status ===
                                "OBSERVED"
                                  ? `${result.presence?.hits ?? 0}/${result.presence?.n ?? 0}`
                                  : "UNKNOWN"
                              }

                            </div>

                            <div className="text-xs text-zinc-600">
                              {
                                result.status ===
                                "OBSERVED"
                                  ? "target mentions"
                                  : "not measurable"
                              }
                            </div>

                          </div>

                        </div>

                      </div>

                    ),
                  )
                }

              </div>

            </div>

          )
          : null
      }

    </section>
  );

}


function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {

  return (
    <div className="bg-[#0b0e11] p-4">

      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">
        {label}
      </div>

      <div className="mt-2 text-lg font-medium text-zinc-200">
        {value}
      </div>

    </div>
  );

}




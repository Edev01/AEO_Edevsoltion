"use client";

import {
  useEffect,
  useState,
} from "react";


type Competitor = {
  name: string;
  mentions: number;
  validTrials: number;
  rate: number;

  trialFiles: string[];

  excerpts: Array<{
    fileName: string;
    text: string;
  }>;
};


type Digest = {
  evidenceStatus: string;

  targetBrand: string;

  validTrials: number;

  target: {
    mentions: number;
    absences: number;
    rate: number;
  };

  recurringCompetitors:
    Competitor[];

  signals: Array<{
    id: string;
    kind: string;
    status: string;
    title: string;
    detail: string;
  }>;
};


function pct(
  value: number,
) {
  return `${Math.round(
    value * 100,
  )}%`;
}


export function CompetitiveIntelligencePanel() {

  const [
    digest,
    setDigest,
  ] =
    useState<Digest | null>(
      null,
    );


  useEffect(() => {

    fetch(
      "/api/seroq/competitive",
      {
        cache:
          "no-store",
      },
    )
      .then((r) =>
        r.json(),
      )
      .then((data) =>
        setDigest(
          data.digest ??
            null,
        ),
      )
      .catch(() =>
        setDigest(null),
      );

  }, []);


  if (!digest) {
    return null;
  }


  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e11]">

      <div className="border-b border-white/10 px-6 py-6 sm:px-7">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <div className="flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-violet-300" />

              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-violet-200">
                Competitive evidence
              </span>

            </div>

            <h2 className="mt-3 text-xl font-semibold text-zinc-100">
              Who AI chose instead
            </h2>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
              Names recurring across independently sampled answers to the same buyer journey. One-off mentions are not promoted to recurring competitors.
            </p>

          </div>


          <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">

            {
              digest.validTrials
            } measured responses

          </div>

        </div>

      </div>


      <div className="px-6 py-6 sm:px-7">

        <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.035] p-5">

          <div className="flex flex-wrap items-center gap-3">

            <span className="rounded-full border border-amber-300/20 px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-amber-200">
              OBSERVED
            </span>

            <span className="font-medium text-zinc-100">
              {
                digest.targetBrand
              }:{" "}
              {
                digest.target
                  .mentions
              }/
              {
                digest.validTrials
              }
            </span>

          </div>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            Target presence in this measured buyer journey:{" "}
            {
              pct(
                digest.target
                  .rate,
              )
            }.
          </p>

        </div>


        <div className="mt-6">

          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
            Recurring recommendations
          </div>


          {
            digest
              .recurringCompetitors
              .length === 0
              ? (

                <div className="mt-4 rounded-2xl border border-white/10 p-5 text-sm text-zinc-500">
                  No competitor name met the recurrence threshold yet.
                </div>

              )
              : (

                <div className="mt-4 grid gap-3">

                  {
                    digest
                      .recurringCompetitors
                      .map(
                        (
                          competitor,
                        ) => (

                          <article
                            key={
                              competitor.name
                            }
                            className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                          >

                            <div className="flex flex-wrap items-center justify-between gap-4">

                              <div>

                                <h3 className="text-base font-medium text-zinc-100">
                                  {
                                    competitor.name
                                  }
                                </h3>

                                <p className="mt-1 text-xs text-zinc-500">
                                  Appeared in{" "}
                                  {
                                    competitor.mentions
                                  }
                                  /
                                  {
                                    competitor.validTrials
                                  } measured responses
                                </p>

                              </div>


                              <div className="text-2xl font-semibold tracking-tight text-zinc-100">

                                {
                                  pct(
                                    competitor.rate,
                                  )
                                }

                              </div>

                            </div>


                            {
                              competitor
                                .excerpts[0]
                                ?.text
                                ? (

                                  <div className="mt-4 border-l border-white/10 pl-4 text-sm leading-6 text-zinc-400">

                                    {
                                      competitor
                                        .excerpts[0]
                                        .text
                                    }

                                  </div>

                                )
                                : null
                            }

                          </article>

                        ),
                      )
                  }

                </div>

              )
          }

        </div>


        <div className="mt-6 rounded-2xl border border-violet-300/15 bg-violet-300/[0.025] p-5">

          <div className="flex items-center gap-3">

            <span className="rounded-full border border-violet-300/20 px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-violet-200">
              NEXT
            </span>

            <span className="font-medium text-zinc-100">
              Evidence comparison
            </span>

          </div>

          <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
            Recurrence tells us who repeatedly wins. It does not tell us why. Seroq will next inspect public evidence for these recurring winners versus the target before generating a WHY or intervention.
          </p>

        </div>

      </div>

    </section>
  );
}


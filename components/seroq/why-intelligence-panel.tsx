"use client";

import {
  useEffect,
  useState,
} from "react";


type Packet = {

  observations: {
    validTrials: number;
    targetMentions: number;

    recurringCompetitors:
      Array<{
        name: string;
        mentions: number;
        rate: number;
      }>;
  };


  gaps:
    Array<{
      dimension: string;
      competitorSupport: number;
      recurringCompetitors: string[];
      explanation: string;
    }>;


  inference: {
    statement: string;
    limitation: string;
  };


  action: {
    title: string;
    reason: string;
    workPackage: string[];
    validation: string;
  };

};


function pretty(
  value: string,
) {
  return value
    .replaceAll(
      "-",
      " ",
    )
    .replace(
      /\b\w/g,
      (c) =>
        c.toUpperCase(),
    );
}


export function WhyIntelligencePanel() {

  const [
    packet,
    setPacket,
  ] =
    useState<Packet | null>(
      null,
    );


  useEffect(() => {

    fetch(
      "/api/seroq/why",
      {
        cache:
          "no-store",
      },
    )
      .then((r) =>
        r.json(),
      )
      .then((data) =>
        setPacket(
          data.packet ??
            null,
        ),
      )
      .catch(() =>
        setPacket(null),
      );

  }, []);


  if (!packet) {
    return null;
  }


  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e11]">

      <div className="border-b border-white/10 px-6 py-6 sm:px-7">

        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
          WHY intelligence
        </div>

        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
          Why this gap may be addressable
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          Seroq separates what the AI actually did, what public evidence verifies, and what can only be inferred.
        </p>

      </div>


      <div className="space-y-5 px-6 py-6 sm:px-7">


        <EvidenceBlock
          status="OBSERVED"
          title={`${packet.observations.targetMentions}/${packet.observations.validTrials} target mentions`}
          text={
            `Recurring winners: ` +
            packet.observations
              .recurringCompetitors
              .map(
                (item) =>
                  `${item.name} ${item.mentions}/${packet.observations.validTrials}`,
              )
              .join(", ")
          }
        />


        <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.025] p-5">

          <div className="text-[10px] font-bold tracking-[0.16em] text-emerald-200">
            VERIFIED PUBLIC PROOF PATTERNS
          </div>


          <div className="mt-4 grid gap-3">

            {
              packet.gaps.map(
                (gap) => (

                  <div
                    key={
                      gap.dimension
                    }
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >

                    <div className="font-medium text-zinc-100">
                      {
                        pretty(
                          gap.dimension,
                        )
                      }
                    </div>

                    <div className="mt-1 text-sm text-zinc-400">
                      {
                        gap.competitorSupport
                      } recurring competitors publish this evidence:
                      {" "}
                      {
                        gap.recurringCompetitors.join(
                          ", ",
                        )
                      }
                    </div>

                  </div>

                ),
              )
            }

          </div>

        </div>


        <EvidenceBlock
          status="INFERRED"
          title="Plausible evidence deficit"
          text={
            packet.inference
              .statement
          }
        />


        <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">

          <div className="text-[10px] font-bold tracking-[0.16em] text-zinc-500">
            LIMITATION
          </div>

          <p className="mt-3 text-sm leading-6 text-zinc-400">
            {
              packet.inference
                .limitation
            }
          </p>

        </div>


        <div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.035] p-5">

          <div className="text-[10px] font-bold tracking-[0.16em] text-cyan-200">
            ACTION
          </div>

          <h3 className="mt-3 text-lg font-medium text-zinc-100">
            {
              packet.action
                .title
            }
          </h3>

          <p className="mt-2 text-sm leading-6 text-zinc-400">
            {
              packet.action
                .reason
            }
          </p>


          <div className="mt-5 grid gap-2">

            {
              packet.action
                .workPackage
                .map(
                  (
                    step,
                    index,
                  ) => (

                    <div
                      key={
                        index
                      }
                      className="flex gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-zinc-300"
                    >

                      <span className="text-zinc-600">
                        {
                          String(
                            index + 1,
                          ).padStart(
                            2,
                            "0",
                          )
                        }
                      </span>

                      <span>
                        {step}
                      </span>

                    </div>

                  ),
                )
            }

          </div>


          <div className="mt-5 border-t border-white/10 pt-4">

            <div className="text-[10px] font-bold tracking-[0.16em] text-zinc-500">
              VALIDATION
            </div>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {
                packet.action
                  .validation
              }
            </p>

          </div>

        </div>

      </div>

    </section>
  );
}


function EvidenceBlock({
  status,
  title,
  text,
}: {
  status:
    "OBSERVED" |
    "INFERRED";

  title:
    string;

  text:
    string;
}) {

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">

      <div className="flex flex-wrap items-center gap-3">

        <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-zinc-300">
          {status}
        </span>

        <span className="font-medium text-zinc-100">
          {title}
        </span>

      </div>

      <p className="mt-3 text-sm leading-6 text-zinc-400">
        {text}
      </p>

    </div>
  );
}


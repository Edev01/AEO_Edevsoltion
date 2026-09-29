"use client";

import {
  useEffect,
  useState,
} from "react";

type Measurement = {
  fileName: string;

  summary: {
    methodology: string;
    evidenceStatus: string;

    provider: string;
    instrument: string;

    targetBrand: string;
    prompt: string;

    validTrials: number;
    failedTrials: number;

    mentions: number;
    absences: number;

    presence: {
      hits: number;
      n: number;
      rate: number;

      confidenceInterval: {
        level: number;
        low: number;
        high: number;
        method: string;
      };
    };

    interpretation: string;

    generatedAt: string;
  };
};

function pct(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function interpretationText(
  value: string,
) {
  switch (value) {
    case "TARGET_NOT_OBSERVED_IN_SAMPLE":
      return "Target not observed in this sample";

    case "TARGET_OBSERVED_IN_ALL_SAMPLES":
      return "Target observed in every sample";

    case "TARGET_VISIBILITY_IS_VARIABLE":
      return "Visibility varied across samples";

    case "INSUFFICIENT_VALID_SAMPLES":
      return "More valid observations required";

    default:
      return value
        .replaceAll("_", " ")
        .toLowerCase();
  }
}

export function LiveMeasurementPanel() {
  const [
    measurement,
    setMeasurement,
  ] =
    useState<Measurement | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  useEffect(() => {
    let active = true;

    fetch(
      "/api/seroq/measurement/latest",
      {
        cache: "no-store",
      },
    )
      .then((response) =>
        response.json(),
      )
      .then((data) => {
        if (!active) {
          return;
        }

        setMeasurement(
          data.measurement ??
            null,
        );
      })
      .catch(() => {
        if (active) {
          setMeasurement(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.025] p-6">
        <div className="text-sm text-zinc-500">
          Loading real AI measurement…
        </div>
      </section>
    );
  }

  if (!measurement) {
    return null;
  }

  const { summary } =
    measurement;

  const {
    confidenceInterval,
  } =
    summary.presence;

  const rate =
    pct(
      summary.presence.rate,
    );

  const ciLow =
    pct(
      confidenceInterval.low,
    );

  const ciHigh =
    pct(
      confidenceInterval.high,
    );

  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-cyan-300/15 bg-[#0b0e11]">

      <div className="border-b border-white/10 px-6 py-5 sm:px-7">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>

            <div className="flex items-center gap-2">

              <span className="h-2 w-2 rounded-full bg-cyan-300" />

              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Live consumer-AI measurement
              </span>

            </div>

            <h2 className="mt-3 text-xl font-semibold tracking-tight text-zinc-100">
              {summary.targetBrand}
            </h2>

            <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-500">
              Repeated measurement of a real buyer journey through the logged-in{" "}
              {summary.provider} consumer interface.
            </p>

          </div>

          <a
            href="/evidence"
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/5"
          >
            View Evidence
          </a>

        </div>

      </div>


      <div className="grid md:grid-cols-4">

        <Metric
          label="Observed presence"
          value={`${summary.mentions}/${summary.validTrials}`}
          detail={rate}
        />

        <Metric
          label="95% confidence interval"
          value={`${ciLow}–${ciHigh}`}
          detail={
            confidenceInterval.method
          }
        />

        <Metric
          label="Valid trials"
          value={String(
            summary.validTrials,
          )}
          detail={
            summary.failedTrials ===
            0
              ? "No failed measurements"
              : `${summary.failedTrials} UNKNOWN`
          }
        />

        <Metric
          label="Evidence"
          value={
            summary.evidenceStatus
          }
          detail="Consumer UI"
          last
        />

      </div>


      <div className="border-t border-white/10 px-6 py-6 sm:px-7">

        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">
          Buyer journey
        </div>

        <p className="mt-2 max-w-5xl text-sm leading-6 text-zinc-300">
          {summary.prompt}
        </p>


        <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-300/[0.035] p-5">

          <div className="flex flex-wrap items-center gap-3">

            <span className="rounded-full border border-amber-300/20 bg-amber-300/5 px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-amber-200">
              OBSERVED
            </span>

            <span className="font-medium text-zinc-100">
              {interpretationText(
                summary.interpretation,
              )}
            </span>

          </div>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">

            Seroq observed{" "}
            <strong className="font-medium text-zinc-200">
              {summary.mentions} mention
              {summary.mentions ===
              1
                ? ""
                : "s"}
            </strong>{" "}
            across{" "}
            <strong className="font-medium text-zinc-200">
              {summary.validTrials} valid trials
            </strong>
            .

            {" "}
            This is evidence of what occurred in this measurement set—not a claim that the brand has a permanent{" "}
            {rate} visibility rate.

          </p>

        </div>


        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">

          <div className="flex items-center gap-3">

            <span className="rounded-full border border-violet-300/20 bg-violet-300/5 px-3 py-1 text-[10px] font-bold tracking-[0.16em] text-violet-200">
              INFERRED
            </span>

            <span className="font-medium text-zinc-100">
              Candidate recommendation gap
            </span>

          </div>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-zinc-400">
            Because the target was absent from a commercially relevant buyer journey across this sample, Seroq can investigate the gap. The measurement does not yet establish why the omission occurred or which intervention caused future changes.
          </p>

        </div>

      </div>

    </section>
  );
}


function Metric({
  label,
  value,
  detail,
  last = false,
}: {
  label: string;
  value: string;
  detail: string;
  last?: boolean;
}) {
  return (
    <div
      className={[
        "px-6 py-6 sm:px-7",
        !last
          ? "border-b border-white/10 md:border-b-0 md:border-r"
          : "",
      ].join(" ")}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-zinc-500">
        {label}
      </div>

      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">
        {value}
      </div>

      <div className="mt-1 text-xs text-zinc-500">
        {detail}
      </div>
    </div>
  );
}


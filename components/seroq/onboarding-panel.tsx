"use client";

import {
  useState,
} from "react";


export type SeroqOnboardingResult = {

  website:
    string;

  brandName:
    string;

  aliases:
    string[];

  industry:
    string;

  offerSummary:
    string;

  competitors:
    Array<{
      name:
        string;

      reason:
        string;
    }>;

  buyerJourneys:
    Array<{
      query:
        string;

      intent:
        string;

      commercialValue:
        string;
    }>;

};


export function SeroqOnboardingPanel({
  initialWebsite,
  onApply,
}: {

  initialWebsite:
    string;

  onApply:
    (
      result:
        SeroqOnboardingResult,
    ) => void;

}) {

  const [
    website,
    setWebsite,
  ] =
    useState(
      initialWebsite,
    );


  const [
    result,
    setResult,
  ] =
    useState<SeroqOnboardingResult | null>(
      null,
    );


  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );


  async function analyze() {

    setBusy(
      true,
    );

    setError(
      null,
    );


    try {

      const response =
        await fetch(
          "/api/seroq/onboard",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                website,
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
            "Website analysis failed.",
        );

      }


      setResult(
        data,
      );

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


  return (
    <section className="mb-8 overflow-hidden rounded-3xl border border-white/10 bg-[#0b0e11]">

      <div className="px-6 py-7 sm:px-7">

        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-200">
          Start Seroq
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-100">
          One website. Seroq builds the buyer map.
        </h1>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
          We inspect the public site, identify the brand and market, then create unbranded commercial questions for live AI measurement.
        </p>


        <div className="mt-5 flex flex-col gap-2 sm:flex-row">

          <input
            value={
              website
            }
            onChange={
              (
                event,
              ) =>
                setWebsite(
                  event.target.value,
                )
            }
            placeholder="https://company.com"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-cyan-300/30"
          />


          <button
            type="button"
            disabled={
              busy ||
              !website.trim()
            }
            onClick={
              () =>
                void analyze()
            }
            className="rounded-xl border border-cyan-300/20 bg-cyan-300/[0.07] px-5 py-3 text-sm font-medium text-cyan-100 disabled:cursor-wait disabled:opacity-40"
          >
            {
              busy
                ? "Analyzing website…"
                : "Analyze website"
            }
          </button>

        </div>


        {
          error
            ? (
              <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[0.04] p-4 text-sm text-red-200">
                {error}
              </div>
            )
            : null
        }


        {
          result
            ? (

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">

                <div className="flex flex-wrap items-start justify-between gap-4">

                  <div>

                    <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-200">
                      Website analyzed
                    </div>

                    <div className="mt-2 text-xl font-medium text-zinc-100">
                      {
                        result.brandName
                      }
                    </div>

                    <div className="mt-1 text-sm text-zinc-500">
                      {
                        result.industry
                      }
                    </div>

                  </div>


                  <div className="flex gap-6 text-right">

                    <div>

                      <div className="text-xl font-semibold text-zinc-100">
                        {
                          result.buyerJourneys.length
                        }
                      </div>

                      <div className="text-xs text-zinc-600">
                        buyer journeys
                      </div>

                    </div>

                    <div>

                      <div className="text-xl font-semibold text-zinc-100">
                        {
                          result.competitors.length
                        }
                      </div>

                      <div className="text-xs text-zinc-600">
                        candidate rivals
                      </div>

                    </div>

                  </div>

                </div>


                {
                  result.offerSummary
                    ? (
                      <p className="mt-4 text-sm leading-6 text-zinc-400">
                        {
                          result.offerSummary
                        }
                      </p>
                    )
                    : null
                }


                <div className="mt-5">

                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-600">
                    First buyer journeys
                  </div>

                  <div className="mt-2 grid gap-2">

                    {
                      result.buyerJourneys
                        .slice(
                          0,
                          4,
                        )
                        .map(
                          (
                            journey,
                          ) => (

                            <div
                              key={
                                journey.query
                              }
                              className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-zinc-300"
                            >
                              {
                                journey.query
                              }
                            </div>

                          ),
                        )
                    }

                  </div>

                </div>


                <button
                  type="button"
                  onClick={
                    () =>
                      onApply(
                        result,
                      )
                  }
                  className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] px-5 py-2.5 text-sm font-medium text-emerald-100"
                >
                  Use this Seroq setup
                </button>

              </div>

            )
            : null
        }

      </div>

    </section>
  );

}


import Link from "next/link";
import { readLatestSeroqCapture } from "@/lib/server/seroq-captures";

export const dynamic = "force-dynamic";

const statusStyles = {
  OBSERVED:
    "border-cyan-400/25 bg-cyan-400/10 text-cyan-200",
  VERIFIED:
    "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  INFERRED:
    "border-amber-400/25 bg-amber-400/10 text-amber-200",
  UNKNOWN:
    "border-zinc-500/30 bg-zinc-500/10 text-zinc-300",
};

export default async function EvidencePage() {
  const latest = await readLatestSeroqCapture();

  if (!latest) {
    return (
      <main className="min-h-screen bg-[#090b0d] text-zinc-100">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <Link
            href="/dashboard"
            className="text-sm text-zinc-400 hover:text-white"
          >
            ← Executive Intelligence
          </Link>

          <h1 className="mt-10 text-4xl font-semibold tracking-tight">
            Evidence
          </h1>

          <p className="mt-4 text-zinc-400">
            No real Seroq observations have been captured yet.
          </p>
        </div>
      </main>
    );
  }

  const { capture, metrics, findings } = latest.intelligence;

  return (
    <main className="min-h-screen bg-[#090b0d] text-zinc-100">
      <div className="mx-auto max-w-7xl px-6 py-10">

        <div className="flex items-center justify-between gap-6">
          <div>
            <Link
              href="/dashboard"
              className="text-sm text-zinc-500 transition hover:text-zinc-200"
            >
              ← Executive Intelligence
            </Link>

            <div className="mt-7 flex items-center gap-3">
              <div className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.7)]" />

              <span className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                Real observation
              </span>
            </div>

            <h1 className="mt-4 text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
              What AI actually showed the buyer.
            </h1>

            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-400">
              Raw consumer-interface evidence first. Interpretation second.
              Seroq never replaces missing evidence with synthetic certainty.
            </p>
          </div>

          <div className="hidden rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-right md:block">
            <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">
              Instrument
            </div>

            <div className="mt-1 text-sm font-medium text-zinc-200">
              {capture.provider || "Unknown"} ·{" "}
              {capture.instrument || "consumer-ui"}
            </div>
          </div>
        </div>


        <section className="mt-10 grid gap-4 md:grid-cols-3">

          <MetricCard
            label="Target presence"
            value={metrics.targetPresent ? "Present" : "Absent"}
            supporting={
              capture.targetBrand
                ? capture.targetBrand
                : "Target brand"
            }
          />

          <MetricCard
            label="Captured sources"
            value={String(metrics.sourceCount)}
            supporting={
              metrics.sourceCount > 0
                ? "Source evidence available"
                : "No source URLs extracted"
            }
          />

          <MetricCard
            label="Evidence status"
            value={capture.evidenceStatus || "OBSERVED"}
            supporting="Consumer AI interface"
          />

        </section>


        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Buyer journey
              </div>

              <h2 className="mt-2 text-xl font-medium">
                Commercial discovery query
              </h2>
            </div>

            {capture.capturedAt ? (
              <div className="text-sm text-zinc-500">
                {new Date(capture.capturedAt).toLocaleString()}
              </div>
            ) : null}

          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5 text-[15px] leading-7 text-zinc-200">
            {capture.prompt}
          </div>

        </section>


        <section className="mt-8">

          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Seroq interpretation
            </div>

            <h2 className="mt-2 text-2xl font-semibold">
              Evidence-labelled findings
            </h2>
          </div>

          <div className="grid gap-4">

            {findings.map((finding, index) => (
              <article
                key={`${finding.title}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/[0.025] p-6"
              >
                <div
                  className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-bold tracking-[0.16em] ${
                    statusStyles[finding.status]
                  }`}
                >
                  {finding.status}
                </div>

                <h3 className="mt-4 text-lg font-medium text-zinc-100">
                  {finding.title}
                </h3>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-400">
                  {finding.detail}
                </p>
              </article>
            ))}

          </div>

        </section>


        <section className="mt-8 rounded-3xl border border-white/10 bg-[#0d1013]">

          <div className="border-b border-white/10 px-6 py-5 sm:px-8">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Raw evidence
            </div>

            <h2 className="mt-2 text-2xl font-semibold">
              {capture.provider || "AI"} response
            </h2>
          </div>

          <div className="whitespace-pre-wrap px-6 py-7 text-[15px] leading-7 text-zinc-300 sm:px-8">
            {capture.response || "No response body captured."}
          </div>

        </section>


        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-8">

          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Captured citations
          </div>

          <h2 className="mt-2 text-2xl font-semibold">
            Sources
          </h2>

          {(capture.sources?.length ?? 0) === 0 ? (
            <div className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-5">
              <div className="font-medium text-amber-100">
                No extractable source URLs were captured.
              </div>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                This is recorded as missing citation evidence, not as zero
                authority and not as proof that the model used no sources.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {capture.sources?.map((source, index) => (
                <div
                  key={`${source.url || source.title}-${index}`}
                  className="rounded-xl border border-white/10 bg-black/20 p-4"
                >
                  <div className="font-medium">
                    {source.title || source.url}
                  </div>

                  {source.url ? (
                    <div className="mt-1 break-all text-sm text-cyan-300">
                      {source.url}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

        </section>


        <section className="mt-8 rounded-3xl border border-cyan-300/15 bg-cyan-300/[0.035] p-6 sm:p-8">

          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/70">
            Next Seroq action
          </div>

          <h2 className="mt-2 text-2xl font-semibold">
            Diagnose the evidence gap.
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-zinc-400">
            Repeat this buyer journey, identify recurring competitors, then
            compare their publicly verifiable proof against the target.
            Only after that should Seroq explain why the gap is plausibly
            addressable and generate an intervention.
          </p>

        </section>

      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  supporting,
}: {
  label: string;
  value: string;
  supporting: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-6">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </div>

      <div className="mt-3 text-3xl font-semibold tracking-tight">
        {value}
      </div>

      <div className="mt-2 text-sm text-zinc-500">
        {supporting}
      </div>
    </div>
  );
}

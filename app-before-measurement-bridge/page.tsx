"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuditResult = {
  status: "measured" | "unknown" | "failed";
  certainty: "VERIFIED" | "UNKNOWN";
  source?: string;
  url?: string;
  measuredAt?: string;
  score: number | null;
  band: string | null;
  error?: string | null;
  checks?: Record<string, unknown> | null;
};

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;

    const oldHtmlOverflow = html.style.overflow;
    const oldBodyOverflow = body.style.overflow;
    const oldHtmlHeight = html.style.height;
    const oldBodyHeight = body.style.height;

    html.style.overflow = "auto";
    body.style.overflow = "auto";
    html.style.height = "auto";
    body.style.height = "auto";

    return () => {
      html.style.overflow = oldHtmlOverflow;
      body.style.overflow = oldBodyOverflow;
      html.style.height = oldHtmlHeight;
      body.style.height = oldBodyHeight;
    };
  }, []);

  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState("");

  async function runScan() {
    if (!url.trim() || scanning) return;

    setScanning(true);
    setResult(null);
    setError("");

    try {
      const response = await fetch("/api/geo-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      const data = (await response.json()) as AuditResult;

      if (!response.ok && data.status !== "unknown") {
        throw new Error(data.error || "Scan failed");
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setScanning(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#06100e] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[-350px] h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-emerald-400/[0.08] blur-[120px]" />
        <div className="absolute bottom-[-300px] right-[-150px] h-[600px] w-[600px] rounded-full bg-cyan-400/[0.05] blur-[120px]" />
      </div>

      <nav className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-6 py-7 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-lg font-semibold text-emerald-300">
            Q
          </div>
          <span className="text-xl font-semibold tracking-[0.28em]">
            SEROQ
          </span>
        </div>

        <button
          onClick={() => router.push("/dashboard")}
          className="rounded-lg border border-emerald-300/35 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-300/10"
        >
          Open Intelligence
        </button>
      </nav>

      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-6 pb-24 pt-24 text-center lg:pt-32">
        <div className="mb-8 rounded-full border border-emerald-300/20 bg-emerald-300/[0.06] px-4 py-2 text-xs uppercase tracking-[0.25em] text-emerald-200/80">
          AI Customer Acquisition Intelligence
        </div>

        <h1 className="max-w-5xl text-5xl font-semibold leading-[1.06] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
          Be the brand they{" "}
          <span className="text-emerald-300">find.</span>
          <br />
          Become the brand they{" "}
          <span className="text-emerald-300">choose.</span>
        </h1>

        <p className="mt-8 max-w-2xl text-lg leading-8 text-white/55">
          See how AI search understands and recommends your business, where
          competitors are winning, and which opportunities deserve action.
        </p>

        <div className="mt-12 w-full max-w-3xl">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-2 shadow-2xl backdrop-blur">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && runScan()}
                placeholder="Enter your website — e.g. yourcompany.com"
                className="min-w-0 flex-1 rounded-xl bg-black/20 px-5 py-4 text-white outline-none placeholder:text-white/30"
              />

              <button
                onClick={runScan}
                disabled={scanning}
                className="rounded-xl bg-emerald-300 px-7 py-4 font-semibold text-[#04100c] transition hover:bg-emerald-200 disabled:opacity-60"
              >
                {scanning ? "Measuring..." : "Run Seroq Scan →"}
              </button>
            </div>
          </div>

          <p className="mt-4 text-xs text-white/30">
            Evidence before conclusions.
          </p>
        </div>

        {scanning && (
          <div className="mt-10 w-full max-w-3xl rounded-2xl border border-emerald-300/15 bg-[#0a1714] p-7 text-left">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 animate-pulse rounded-full bg-emerald-300" />
              <span className="text-emerald-200">
                Measuring {url}
              </span>
            </div>
            <p className="mt-4 text-sm leading-6 text-white/45">
              Checking technical AI-search readiness and collecting verifiable
              website signals.
            </p>
          </div>
        )}

        {error && (
          <div className="mt-10 w-full max-w-3xl rounded-2xl border border-red-400/20 bg-red-400/[0.05] p-6 text-left">
            <div className="text-sm font-medium text-red-300">
              Measurement failed
            </div>
            <p className="mt-2 text-sm text-white/45">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-10 w-full max-w-4xl text-left">
            <div className="rounded-2xl border border-white/10 bg-[#091512] p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300/70">
                    Seroq Measurement
                  </div>

                  <h2 className="mt-3 text-2xl font-semibold">
                    {cleanDomain(result.url || url)}
                  </h2>
                </div>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs ${
                    result.certainty === "VERIFIED"
                      ? "border-emerald-300/20 bg-emerald-300/[0.07] text-emerald-200"
                      : "border-amber-300/20 bg-amber-300/[0.07] text-amber-200"
                  }`}
                >
                  {result.certainty}
                </span>
              </div>

              {result.status === "measured" ? (
                <>
                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    <Card
                      label="Technical readiness"
                      value={
                        result.score === null ? "—" : `${result.score}/100`
                      }
                    />

                    <Card
                      label="Audit band"
                      value={(result.band || "Unknown").toUpperCase()}
                    />

                    <Card
                      label="Evidence source"
                      value={result.source || "GEO Optimizer"}
                    />
                  </div>

                  <div className="mt-6 rounded-xl border border-white/[0.06] bg-black/10 p-5">
                    <div className="text-xs uppercase tracking-[0.15em] text-white/35">
                      What this means
                    </div>

                    <p className="mt-3 text-sm leading-7 text-white/55">
                      This is a measured technical-readiness audit — not a claim
                      that the score caused AI recommendations. Seroq keeps
                      technical evidence separate from observed recommendation
                      performance.
                    </p>
                  </div>
                </>
              ) : (
                <div className="mt-6 rounded-xl border border-amber-300/15 bg-amber-300/[0.04] p-5">
                  <div className="text-sm font-medium text-amber-200">
                    Measurement unavailable
                  </div>

                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {result.error || "The site could not be measured reliably."}
                  </p>

                  <p className="mt-3 text-xs text-white/30">
                    Seroq does not convert failed measurements into a score of
                    zero.
                  </p>
                </div>
              )}

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#06100e]"
                >
                  Open Full Intelligence →
                </button>

                <button
                  onClick={runScan}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm text-white/60"
                >
                  Measure again
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="relative z-10 border-t border-white/[0.06]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-3">
          <Feature
            number="01"
            title="Measure"
            text="Observe AI visibility, citations, competitors and technical readiness."
          />
          <Feature
            number="02"
            title="Understand"
            text="Separate measured evidence from inference and identify commercially relevant gaps."
          />
          <Feature
            number="03"
            title="Improve"
            text="Prioritize interventions, implement improvements and measure what changed."
          />
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/[0.06] px-6 py-8 text-center text-xs text-white/25">
        SEROQ — AI Search Intelligence
      </footer>
    </main>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/10 p-5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-white/30">
        {label}
      </div>
      <div className="mt-3 text-lg font-medium text-emerald-200">
        {value}
      </div>
    </div>
  );
}

function Feature({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <p className="text-xs tracking-[0.2em] text-emerald-300/50">{number}</p>
      <h3 className="mt-4 text-xl font-semibold">{title}</h3>
      <p className="mt-3 leading-7 text-white/45">{text}</p>
    </div>
  );
}

function cleanDomain(url: string) {
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0];
}


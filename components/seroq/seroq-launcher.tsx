"use client";

import { useState } from "react";

import type {
  Provider,
  ScrapeRun,
} from "@/components/dashboard/types";

type Setup = {
  brand: string;
  website: string;
  queries: string[];
  competitors: string[];
  category?: string;
};

type Props = {
  onSetup: (setup: Setup) => void;
  onImportRuns: (
    runs: ScrapeRun[],
  ) => void;
};

function isProvider(
  value: string,
): value is Provider {
  return [
    "chatgpt",
    "perplexity",
    "copilot",
    "gemini",
    "google_ai",
  ].includes(value);
}

export function SeroqLauncher({
  onSetup,
  onImportRuns,
}: Props) {
  const [url, setUrl] =
    useState("");

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  async function start() {
    if (busy) return;

    if (!url.trim()) {
      setMessage(
        "Enter a company website first.",
      );
      return;
    }

    setBusy(true);

    setMessage(
      "Understanding company → building buyer journeys → measuring AI answers…",
    );

    try {
      const response = await fetch(
        "/api/seroq/full-scan",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            url: url.trim(),
          }),
        },
      );

      const data =
        await response.json();

      if (!response.ok || !data?.ok) {
        setMessage(
          data?.error ||
            "Seroq scan could not complete.",
        );

        return;
      }

      const setup: Setup = {
        brand:
          data.setup?.brand || "",

        website:
          data.setup?.website || "",

        queries:
          Array.isArray(
            data.setup?.queries,
          )
            ? data.setup.queries
            : [],

        competitors:
          Array.isArray(
            data.setup?.competitors,
          )
            ? data.setup.competitors
            : [],

        category:
          data.setup?.category || "",
      };

      onSetup(setup);

      const now =
        new Date().toISOString();

      const imported: ScrapeRun[] =
        [];

      let preserved = 0;
      let unknown = 0;

      for (
        const observation of
        data.observations || []
      ) {
        if (
          observation
            .measurementStatus !==
          "MEASURED"
        ) {
          unknown++;
          continue;
        }

        const platform =
          String(
            observation.platform ||
              "",
          );

        /*
         * Current chassis doesn't have
         * Claude in its Provider union yet.
         * Preserve it server-side, never
         * mislabel it.
         */
        if (
          !isProvider(platform)
        ) {
          preserved++;
          continue;
        }

        const mention =
          observation.presence
            ?.mention || "no";

        const rate =
          typeof observation
            .presence?.rate ===
          "number"
            ? observation.presence
                .rate
            : mention === "yes"
              ? 1
              : 0;

        let sentiment:
          | "positive"
          | "neutral"
          | "negative"
          | "not-mentioned" =
          "not-mentioned";

        const s =
          observation.raw
            ?.sentiment?.label ??
          observation.raw
            ?.sentiment;

        if (
          s === "positive" ||
          s === "neutral" ||
          s === "negative"
        ) {
          sentiment = s;
        } else if (
          mention === "yes"
        ) {
          sentiment =
            "neutral";
        }

        imported.push({
          provider: platform,

          prompt:
            observation.query ||
            "",

          answer:
            "Full raw AI response preserved in Seroq evidence storage.",

          sources:
            Array.isArray(
              observation.citations,
            )
              ? observation.citations
              : [],

          createdAt: now,

          visibilityScore:
            Math.round(
              rate * 100,
            ),

          sentiment,

          brandMentions:
            mention === "yes"
              ? [setup.brand]
              : [],

          competitorMentions:
            Array.isArray(
              observation.competitors,
            )
              ? observation.competitors
              : [],
        });
      }

      onImportRuns(imported);

      const parts = [
        `${setup.queries.length} buyer journeys`,
        `${imported.length} measured observations`,
      ];

      if (unknown) {
        parts.push(
          `${unknown} unknown`,
        );
      }

      if (preserved) {
        parts.push(
          `${preserved} extra-platform observations preserved`,
        );
      }

      if (
        typeof data
          .measurement?.costUsd ===
        "number"
      ) {
        parts.push(
          `$${data.measurement.costUsd.toFixed(
            4,
          )} measured run cost`,
        );
      }

      setMessage(
        `Complete · ${parts.join(
          " · ",
        )}`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Scan failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-th-accent/30 bg-th-card p-5">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-th-text-accent">
        Start Seroq
      </div>

      <div className="mt-2 text-lg font-semibold text-th-text">
        One website. Seroq does the rest.
      </div>

      <p className="mt-1 text-sm text-th-text-secondary">
        Understand the company, create buyer
        journeys and measure live AI visibility.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          value={url}
          onChange={(e) =>
            setUrl(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              start();
            }
          }}
          placeholder="https://company.com"
          className="min-w-0 flex-1 rounded-xl border border-th-border bg-th-card-alt px-4 py-3 text-sm text-th-text outline-none focus:border-th-accent"
        />

        <button
          onClick={start}
          disabled={busy}
          className="rounded-xl bg-th-accent px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy
            ? "Seroq is working…"
            : "Run full scan"}
        </button>
      </div>

      {message && (
        <div className="mt-3 rounded-xl border border-th-border bg-th-card-alt px-4 py-3 text-sm text-th-text-secondary">
          {message}
        </div>
      )}
    </section>
  );
}


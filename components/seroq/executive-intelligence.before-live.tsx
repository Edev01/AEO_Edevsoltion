"use client";

import type { ScrapeRun } from "@/components/dashboard/types";

type Props = {
  runs: ScrapeRun[];
  brandName: string;
};

type Journey = {
  prompt: string;
  runs: number;
  brandSeen: number;
  brandRate: number;
  citationSeen: number;
  competitors: { name: string; count: number }[];
};

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function shortPrompt(value: string) {
  return value.length > 115 ? value.slice(0, 112) + "…" : value;
}

export function ExecutiveIntelligence({ runs, brandName }: Props) {
  const grouped = new Map<string, ScrapeRun[]>();

  for (const run of runs) {
    const key = run.prompt?.trim();
    if (!key) continue;
    const existing = grouped.get(key) ?? [];
    existing.push(run);
    grouped.set(key, existing);
  }

  const journeys: Journey[] = [...grouped.entries()].map(
    ([prompt, observations]) => {
      let brandSeen = 0;
      let citationSeen = 0;
      const competitorCounts = new Map<string, number>();

      for (const run of observations) {
        if ((run.brandMentions?.length ?? 0) > 0) brandSeen++;

        if ((run.sources?.length ?? 0) > 0) citationSeen++;

        const seenThisRun = new Set<string>();

        for (const competitor of run.competitorMentions ?? []) {
          const name = String(competitor).trim();
          if (!name) continue;

          const key = name.toLowerCase();
          if (seenThisRun.has(key)) continue;
          seenThisRun.add(key);

          competitorCounts.set(
            name,
            (competitorCounts.get(name) ?? 0) + 1,
          );
        }
      }

      return {
        prompt,
        runs: observations.length,
        brandSeen,
        brandRate:
          observations.length > 0 ? brandSeen / observations.length : 0,
        citationSeen,
        competitors: [...competitorCounts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      };
    },
  );

  const totalObservations = runs.length;
  const brandObservations = runs.filter(
    (run) => (run.brandMentions?.length ?? 0) > 0,
  ).length;

  const overallPresence =
    totalObservations > 0 ? brandObservations / totalObservations : 0;

  const missedJourneys = journeys
    .filter((journey) => journey.brandRate < 0.5)
    .sort((a, b) => {
      const competitorA = a.competitors[0]?.count ?? 0;
      const competitorB = b.competitors[0]?.count ?? 0;

      return (
        competitorB - competitorA ||
        a.brandRate - b.brandRate ||
        b.runs - a.runs
      );
    });

  const recurringCompetitors = new Map<string, number>();

  for (const journey of journeys) {
    for (const competitor of journey.competitors) {
      recurringCompetitors.set(
        competitor.name,
        (recurringCompetitors.get(competitor.name) ?? 0) + competitor.count,
      );
    }
  }

  const topCompetitors = [...recurringCompetitors.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const highestGap = missedJourneys[0];

  if (runs.length === 0) {
    return (
      <div className="rounded-2xl border border-th-border bg-th-card p-8">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-th-text-accent">
          Seroq Executive Intelligence
        </div>

        <h2 className="mt-3 text-2xl font-semibold text-th-text">
          No recommendation evidence yet.
        </h2>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-th-text-secondary">
          Run buyer-journey prompts first. Seroq will turn the resulting AI
          observations into recommendation gaps, recurring competitors and
          evidence-backed actions.
        </p>

        <div className="mt-5 rounded-xl border border-th-border bg-th-card-alt p-4 text-sm text-th-text-muted">
          No synthetic score is shown when there is no evidence.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-th-border bg-th-card">
        <div className="border-b border-th-border px-6 py-6">
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-th-text-accent">
            Seroq Executive Intelligence
          </div>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-th-text">
                Where {brandName || "your brand"} wins — and where buyers find someone else.
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-th-text-secondary">
                Based on observed AI responses. Presence is reported as a
                frequency, not an invented universal visibility score.
              </p>
            </div>

            <div className="rounded-full border border-th-border bg-th-card-alt px-3 py-1.5 text-xs text-th-text-muted">
              {totalObservations} observations · {journeys.length} buyer journeys
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-th-border md:grid-cols-3">
          <Metric
            label="Observed presence"
            value={pct(overallPresence)}
            detail={`${brandObservations} of ${totalObservations} responses`}
          />

          <Metric
            label="Journey gaps"
            value={missedJourneys.length}
            detail={`Below 50% observed presence`}
          />

          <Metric
            label="Recurring competitors"
            value={topCompetitors.length}
            detail="Observed across tracked answers"
          />
        </div>
      </section>

      {highestGap && (
        <section className="rounded-2xl border border-th-accent/40 bg-th-accent-soft p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-th-text-accent">
              Highest observed recommendation gap
            </div>

            <div className="rounded-full bg-th-card px-3 py-1 text-xs font-medium text-th-text-accent">
              OBSERVED
            </div>
          </div>

          <h3 className="mt-3 max-w-4xl text-xl font-semibold leading-8 text-th-text">
            {shortPrompt(highestGap.prompt)}
          </h3>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <SmallMetric
              label={`${brandName || "Brand"} presence`}
              value={`${highestGap.brandSeen}/${highestGap.runs}`}
              sub={pct(highestGap.brandRate)}
            />

            <SmallMetric
              label="Leading observed competitor"
              value={highestGap.competitors[0]?.name ?? "None detected"}
              sub={
                highestGap.competitors[0]
                  ? `${highestGap.competitors[0].count}/${highestGap.runs} observations`
                  : "No competitor evidence"
              }
            />

            <SmallMetric
              label="Responses with sources"
              value={`${highestGap.citationSeen}/${highestGap.runs}`}
              sub="Evidence available for investigation"
            />
          </div>

          <div className="mt-5 rounded-xl border border-th-border bg-th-card p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-th-text-muted">
              What Seroq can conclude
            </div>

            <p className="mt-2 text-sm leading-6 text-th-text-secondary">
              This buyer journey currently shows a measurable recommendation
              gap. Competitor recurrence and captured sources tell us where to
              investigate next. They do not, by themselves, prove why an AI
              system selected one company over another.
            </p>
          </div>
        </section>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-th-border bg-th-card p-5">
          <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-th-text-muted">
              Buyer journey map
            </div>
            <h3 className="mt-1 text-lg font-semibold text-th-text">
              Recommendation presence by question
            </h3>
          </div>

          <div className="space-y-2">
            {journeys
              .sort((a, b) => a.brandRate - b.brandRate)
              .slice(0, 12)
              .map((journey) => (
                <div
                  key={journey.prompt}
                  className="rounded-xl border border-th-border bg-th-card-alt p-4"
                >
                  <div className="flex gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium leading-5 text-th-text">
                        {shortPrompt(journey.prompt)}
                      </div>

                      <div className="mt-2 text-xs text-th-text-muted">
                        {journey.runs} observation
                        {journey.runs === 1 ? "" : "s"}
                        {journey.competitors[0]
                          ? ` · recurring: ${journey.competitors[0].name}`
                          : ""}
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      <div className="text-lg font-semibold text-th-text">
                        {pct(journey.brandRate)}
                      </div>
                      <div className="text-[11px] uppercase tracking-wider text-th-text-muted">
                        presence
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-th-border">
                    <div
                      className="h-full rounded-full bg-th-accent"
                      style={{
                        width: `${Math.max(
                          2,
                          Math.round(journey.brandRate * 100),
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section className="rounded-2xl border border-th-border bg-th-card p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-th-text-muted">
            Competitive recurrence
          </div>

          <h3 className="mt-1 text-lg font-semibold text-th-text">
            Brands AI answers keep surfacing
          </h3>

          <div className="mt-4 space-y-3">
            {topCompetitors.length ? (
              topCompetitors.map((competitor, index) => (
                <div
                  key={competitor.name}
                  className="flex items-center gap-3 rounded-xl border border-th-border bg-th-card-alt p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-th-accent-soft text-sm font-semibold text-th-text-accent">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-th-text">
                      {competitor.name}
                    </div>
                    <div className="text-xs text-th-text-muted">
                      {competitor.count} observed appearance
                      {competitor.count === 1 ? "" : "s"}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-th-border bg-th-card-alt p-4 text-sm text-th-text-muted">
                No recurring competitors detected yet.
              </div>
            )}
          </div>

          <div className="mt-5 rounded-xl border border-th-border p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-th-text-muted">
              Next intelligence layer
            </div>

            <p className="mt-2 text-sm leading-6 text-th-text-secondary">
              For each high-value gap, Seroq will compare the target's public
              proof with the evidence exposed by recurring competitors and
              cited sources, then produce an addressable intervention.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="bg-th-card px-6 py-5">
      <div className="text-xs font-medium uppercase tracking-wider text-th-text-muted">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-th-text">
        {value}
      </div>
      <div className="mt-1 text-xs text-th-text-muted">{detail}</div>
    </div>
  );
}

function SmallMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-th-border bg-th-card p-4">
      <div className="text-xs text-th-text-muted">{label}</div>
      <div className="mt-1 truncate text-base font-semibold text-th-text">
        {value}
      </div>
      <div className="mt-1 text-xs text-th-text-secondary">{sub}</div>
    </div>
  );
}


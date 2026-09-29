"use client";

import { useMemo } from "react";

import type {
  ScrapeRun,
  SeroqActionItem,
} from "@/components/dashboard/types";

import {
  classifyRecommendation,
} from "@/lib/seroq/intelligence/recommendation-core.mjs";

import type {
  RecommendationLabel,
} from "@/lib/seroq/intelligence/recommendation-core.mjs";

type Props = {
  action: SeroqActionItem;
  runs: ScrapeRun[];
  targetBrand: string;
  onChange: (patch: Partial<SeroqActionItem>) => void;
};

type OutcomeSummary = {
  total: number;
  classified: number;
  unclassified: number;
  primary: number;
  shortlisted: number;
  qualified: number;
  ordinaryMention: number;
  cautionary: number;
  negative: number;
  absent: number;
  recommendationHits: number;
  recommendationRate: number | null;
};

type ProviderComparison = {
  provider: ScrapeRun["provider"];
  baseline: OutcomeSummary;
  remeasurement: OutcomeSummary;
  recommendationDelta: number | null;
};

function runId(run: ScrapeRun): string {
  return `${run.provider}|${run.createdAt}|${run.prompt}`;
}

function parseTime(value?: string): number | null {
  if (!value) return null;

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pct(value: number | null): string {
  if (value === null) return "UNKNOWN";
  return `${Math.round(value * 100)}%`;
}

function signedPp(value: number | null): string {
  if (value === null) return "NON-COMPARABLE";

  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? "+" : ""}${rounded} pp`;
}

function summarizeOutcomes(
  runs: ScrapeRun[],
  targetBrand: string,
): OutcomeSummary {
  const counts: Record<RecommendationLabel, number> = {
    PRIMARY_RECOMMENDATION: 0,
    SHORTLISTED: 0,
    ORDINARY_MENTION: 0,
    COMPARISON_OR_QUALIFIED: 0,
    CAUTIONARY: 0,
    NEGATIVE: 0,
    ABSENT: 0,
    UNCLASSIFIED: 0,
  };

  for (const run of runs) {
    if (!run.answer?.trim()) { counts.UNCLASSIFIED += 1; continue; }
    const verdict = classifyRecommendation({
      targetBrand,
      queryText: run.prompt,
      responseText: run.answer,
    });

    counts[verdict.label] += 1;
  }

  const total = runs.length;
  const unclassified = counts.UNCLASSIFIED;
  const classified = total - unclassified;

  const recommendationHits =
    counts.PRIMARY_RECOMMENDATION +
    counts.SHORTLISTED;

  return {
    total,
    classified,
    unclassified,
    primary: counts.PRIMARY_RECOMMENDATION,
    shortlisted: counts.SHORTLISTED,
    qualified: counts.COMPARISON_OR_QUALIFIED,
    ordinaryMention: counts.ORDINARY_MENTION,
    cautionary: counts.CAUTIONARY,
    negative: counts.NEGATIVE,
    absent: counts.ABSENT,
    recommendationHits,
    recommendationRate:
      classified > 0 ? recommendationHits / classified : null,
  };
}

function compareSets(
  baseline: ScrapeRun[],
  remeasurement: ScrapeRun[],
  targetBrand: string,
): ProviderComparison[] {
  if (!targetBrand.trim()) return [];

  const providers = new Set([
    ...baseline.map((run) => run.provider),
    ...remeasurement.map((run) => run.provider),
  ]);

  const rows: ProviderComparison[] = [];

  for (const provider of providers) {
    const beforeRuns = baseline.filter(
      (run) => run.provider === provider,
    );

    const afterRuns = remeasurement.filter(
      (run) => run.provider === provider,
    );

    // Provider comparability is strict: both periods must contain
    // observations from the same provider.

    const before = summarizeOutcomes(
      beforeRuns,
      targetBrand,
    );

    const after = summarizeOutcomes(
      afterRuns,
      targetBrand,
    );

    const recommendationDelta =
      before.unclassified === 0 && after.unclassified === 0 &&
      before.recommendationRate !== null &&
      after.recommendationRate !== null
        ? after.recommendationRate -
          before.recommendationRate
        : null;

    rows.push({
      provider,
      baseline: before,
      remeasurement: after,
      recommendationDelta,
    });
  }

  return rows.sort((a, b) =>
    a.provider.localeCompare(b.provider),
  );
}

function outcomeText(summary: OutcomeSummary): string {
  const pieces = [
    `${summary.primary} primary`,
    `${summary.shortlisted} shortlist`,
    `${summary.qualified} qualified`,
    `${summary.ordinaryMention} mention`,
    `${summary.cautionary} caution`,
    `${summary.negative} negative`,
    `${summary.absent} absent`,
  ];

  if (summary.unclassified > 0) {
    pieces.push(`${summary.unclassified} unclassified`);
  }

  return pieces.join(" · ");
}

export function ActionExperimentPanel({
  action,
  runs,
  targetBrand,
  onChange,
}: Props) {
  const journey = action.journey?.trim() ?? "";

  const journeyRuns = useMemo(() => {
    if (!journey) return [];

    return runs
      .filter(
        (run) => run.prompt.trim() === journey,
      )
      .sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );
  }, [runs, journey]);

  const runMap = useMemo(() => {
    const map = new Map<string, ScrapeRun>();
    const conflicts = new Set<string>();
    for (const run of journeyRuns) {
      const key = runId(run);
      const previous = map.get(key);
      if (previous && JSON.stringify(previous) !== JSON.stringify(run)) conflicts.add(key);
      else map.set(key, run);
    }
    for (const key of conflicts) map.delete(key);
    return map;
  }, [journeyRuns]);

  const baselineRuns = useMemo(() => {
    return [...new Set(action.baselineRunIds ?? [])]
      .map((id) => runMap.get(id))
      .filter(
        (run): run is ScrapeRun => Boolean(run),
      );
  }, [action.baselineRunIds, runMap]);

  const remeasurementRuns = useMemo(() => {
    return [...new Set(action.remeasurementRunIds ?? [])]
      .map((id) => runMap.get(id))
      .filter(
        (run): run is ScrapeRun => Boolean(run),
      );
  }, [action.remeasurementRunIds, runMap]);

  const integrityIssues: string[] = [];
  const baselineIds = action.baselineRunIds ?? [];
  const followupIds = action.remeasurementRunIds ?? [];
  const approval = parseTime(action.approvedAt);
  const completion = parseTime(action.completedAt);
  if (action.status !== "completed" || approval === null || completion === null || completion < approval) {
    integrityIssues.push("A valid approval and completed intervention are required.");
  }
  if ([...baselineIds, ...followupIds].some((id) => !runMap.has(id))) {
    integrityIssues.push("Some saved evidence is missing, conflicting or belongs to another journey.");
  }
  if (baselineIds.some((id) => followupIds.includes(id))) {
    integrityIssues.push("Baseline and follow-up share evidence.");
  }
  if (baselineRuns.some((run) => {
    const time = parseTime(run.createdAt);
    return time === null || approval === null || time > approval;
  }) || remeasurementRuns.some((run) => {
    const time = parseTime(run.createdAt);
    return time === null || completion === null || time <= completion || time > Date.now();
  })) integrityIssues.push("Evidence dates do not match the intervention timeline.");
  const providers = new Set([...baselineRuns, ...remeasurementRuns].map((run) => run.provider));
  for (const provider of providers) {
    const before = baselineRuns.filter((run) => run.provider === provider);
    const after = remeasurementRuns.filter((run) => run.provider === provider);
    if (before.length < 3 || after.length < 3) integrityIssues.push(`${provider}: at least 3 observations per period required.`);
    if (before.some((run) => !run.answer.trim()) || after.some((run) => !run.answer.trim())) {
      integrityIssues.push(`${provider}: empty answers are not measurement evidence.`);
    }
    const countries = new Set([...before, ...after].map((run) => run.country?.trim().toUpperCase()));
    if (countries.has(undefined) || countries.has("") || countries.size !== 1) {
      integrityIssues.push(`${provider}: collection country is missing or changed.`);
    }
  }

  const comparisons = useMemo(
    () =>
      compareSets(
        baselineRuns,
        remeasurementRuns,
        targetBrand,
      ),
    [
      baselineRuns,
      remeasurementRuns,
      targetBrand,
    ],
  );

  const completedAtMs = parseTime(
    action.completedAt,
  );

  const eligibleBaseline = useMemo(() => {
    if (!journey) return [];

    const approvalMs = parseTime(
      action.approvedAt,
    );

    if (approvalMs === null) return [];

    return journeyRuns.filter((run) => {
      const runMs = parseTime(run.createdAt);

      return (
        runMs !== null &&
        runMs <= approvalMs
      );
    });
  }, [
    journey,
    journeyRuns,
    action.approvedAt,
  ]);

  const eligibleRemeasurement = useMemo(() => {
    if (
      !journey ||
      completedAtMs === null
    ) {
      return [];
    }

    return journeyRuns.filter((run) => {
      const runMs = parseTime(run.createdAt);

      return (
        runMs !== null &&
        runMs > completedAtMs
      );
    });
  }, [
    journey,
    journeyRuns,
    completedAtMs,
  ]);

  function captureBaseline(): void {
    if (
      action.status !== "new" ||
      !action.approvedAt ||
      eligibleBaseline.length === 0
    ) {
      return;
    }

    onChange({
      baselineRunIds:
        [...new Set(eligibleBaseline.filter((run) => run.answer?.trim() && runMap.has(runId(run))).map(runId))],
    });
  }

  function captureRemeasurement(): void {
    if (
      action.status !== "completed" ||
      eligibleRemeasurement.length === 0
    ) {
      return;
    }

    onChange({
      remeasurementRunIds:
        [...new Set(eligibleRemeasurement.filter((run) => run.answer?.trim() && runMap.has(runId(run))).map(runId))],
    });
  }

  function clearExperiment(): void {
    onChange({
      baselineRunIds: [],
      remeasurementRunIds: [],
    });
  }

  if (!journey) {
    return (
      <div className="mt-3 rounded-lg border border-th-border bg-th-card p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-th-text-muted">
          Experiment integrity
        </div>

        <p className="mt-1 text-xs leading-relaxed text-th-text-muted">
          This action is not linked to a specific buyer journey, so Seroq will
          not manufacture a before/after recommendation experiment for it.
        </p>
      </div>
    );
  }

  if (!targetBrand.trim()) {
    return (
      <div className="mt-3 rounded-lg border border-th-border bg-th-card p-3">
        <div className="text-[11px] font-medium uppercase tracking-wider text-th-text-muted">
          Recommendation experiment unavailable
        </div>

        <p className="mt-1 text-xs leading-relaxed text-th-text-muted">
          Configure the target brand name before Seroq classifies recommendation
          outcomes. Existing baseline and remeasurement references are preserved.
        </p>
      </div>
    );
  }

  const hasBaseline =
    baselineRuns.length > 0;

  const hasRemeasurement =
    remeasurementRuns.length > 0;

  const hasComparableProviders =
    comparisons.length > 0;

  return (
    <div className="mt-3 rounded-lg border border-th-border bg-th-card p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-th-text-muted">
            Recommendation experiment
          </div>

          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-th-text-muted">
            Uses Seroq Recommendation Intelligence v1 on the raw captured answer.
            The comparison requires the exact buyer journey and the same provider.
            "Recommendation" below means PRIMARY_RECOMMENDATION or SHORTLISTED;
            qualified comparison, ordinary mention, caution, negative, and absent
            outcomes remain separate. UNCLASSIFIED observations are shown and
            excluded from the recommendation-rate denominator.
          </p>
        </div>

        {action.status === "new" && !action.approvedAt && (hasBaseline ||
          hasRemeasurement) && (
          <button
            type="button"
            onClick={clearExperiment}
            className="shrink-0 rounded-md border border-th-border px-2.5 py-1 text-[11px] font-medium text-th-text-muted hover:bg-th-card-hover"
          >
            Clear experiment
          </button>
        )}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded-md border border-th-border bg-th-card-alt p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-th-text-muted">
            Baseline observations
          </div>

          <div className="mt-1 text-lg font-semibold text-th-text">
            {baselineRuns.length}
          </div>

          <div className="text-[11px] text-th-text-muted">
            {eligibleBaseline.length} currently eligible
          </div>
        </div>

        <div className="rounded-md border border-th-border bg-th-card-alt p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-th-text-muted">
            Remeasurement observations
          </div>

          <div className="mt-1 text-lg font-semibold text-th-text">
            {remeasurementRuns.length}
          </div>

          <div className="text-[11px] text-th-text-muted">
            {eligibleRemeasurement.length} currently eligible
          </div>
        </div>

        <div className="rounded-md border border-th-border bg-th-card-alt p-2.5">
          <div className="text-[10px] uppercase tracking-wider text-th-text-muted">
            Providers in saved evidence
          </div>

          <div className="mt-1 text-lg font-semibold text-th-text">
            {comparisons.length}
          </div>

          <div className="text-[11px] text-th-text-muted">
            Descriptive samples; collection settings unverified
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {!hasBaseline && action.status === "new" && (
          <button
            type="button"
            disabled={
              !action.approvedAt ||
              eligibleBaseline.length === 0
            }
            onClick={captureBaseline}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-semibold text-th-text-inverse disabled:cursor-not-allowed disabled:opacity-40"
          >
            Capture approved baseline
          </button>
        )}

        {action.status ===
          "completed" && (
          <button
            type="button"
            disabled={
              eligibleRemeasurement.length === 0
            }
            onClick={captureRemeasurement}
            className="rounded-md bg-th-accent px-3 py-1.5 text-xs font-semibold text-th-text-inverse disabled:cursor-not-allowed disabled:opacity-40"
          >
            Capture post-completion remeasurement
          </button>
        )}
      </div>

      {!action.approvedAt && (
        <p className="mt-2 text-[11px] text-th-text-muted">
          Approve this action first. Seroq will not establish a baseline after
          implementation has already begun.
        </p>
      )}

      {action.approvedAt &&
        !hasBaseline &&
        eligibleBaseline.length === 0 && (
          <p className="mt-2 text-[11px] text-th-text-muted">
            No pre-approval observations exist for this exact buyer journey.
            Seroq leaves the baseline empty rather than fabricating one.
          </p>
        )}

      {action.status ===
        "completed" &&
        eligibleRemeasurement.length === 0 && (
          <p className="mt-2 text-[11px] text-th-text-muted">
            No observations have been captured after completion yet. Rerun the
            same buyer journey before recording remeasurement.
          </p>
        )}

      {hasBaseline &&
        hasRemeasurement &&
        !hasComparableProviders && (
          <div className="mt-3 rounded-md border border-th-border bg-th-card-alt p-2.5 text-xs text-th-text-muted">
            Baseline and remeasurement exist, but no provider has classifiable
            observations on both sides. Seroq marks the comparison as
            non-comparable.
          </div>
        )}

      {hasBaseline && hasRemeasurement && integrityIssues.length > 0 && (
        <div role="alert" className="mt-3 text-xs text-th-text-muted">
          Comparison blocked: {integrityIssues.join(" ")}
        </div>
      )}
      {hasComparableProviders && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-th-border text-th-text-muted">
                <th className="px-2 py-2 font-medium">
                  Provider
                </th>
                <th className="px-2 py-2 font-medium">
                  Before recommendation
                </th>
                <th className="px-2 py-2 font-medium">
                  After recommendation
                </th>
                <th className="px-2 py-2 font-medium">
                  Observed delta
                </th>
                <th className="px-2 py-2 font-medium">
                  Before outcome mix
                </th>
                <th className="px-2 py-2 font-medium">
                  After outcome mix
                </th>
              </tr>
            </thead>

            <tbody>
              {comparisons.map((row) => (
                <tr
                  key={row.provider}
                  className="border-b border-th-border/70 last:border-0"
                >
                  <td className="px-2 py-2 font-medium text-th-text">
                    {row.provider}
                  </td>

                  <td className="px-2 py-2 text-th-text-secondary">
                    {pct(
                      row.baseline
                        .recommendationRate,
                    )}
                    <div className="mt-0.5 text-[10px] text-th-text-muted">
                      {row.baseline.recommendationHits}/
                      {row.baseline.classified} classified
                    </div>
                  </td>

                  <td className="px-2 py-2 text-th-text-secondary">
                    {pct(
                      row.remeasurement
                        .recommendationRate,
                    )}
                    <div className="mt-0.5 text-[10px] text-th-text-muted">
                      {row.remeasurement.recommendationHits}/
                      {row.remeasurement.classified} classified
                    </div>
                  </td>

                  <td className="px-2 py-2 font-medium text-th-text">
                    {signedPp(
                      integrityIssues.length === 0 ? row.recommendationDelta : null,
                    )}
                  </td>

                  <td className="px-2 py-2 text-[11px] leading-relaxed text-th-text-muted">
                    {outcomeText(
                      row.baseline,
                    )}
                  </td>

                  <td className="px-2 py-2 text-[11px] leading-relaxed text-th-text-muted">
                    {outcomeText(
                      row.remeasurement,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-3 space-y-1 text-[11px] leading-relaxed text-th-text-muted">
            <p>
              These are descriptive samples, not a verified like-for-like experiment.
              Model version, locale, session strategy and collection settings are
              not recorded in this run format. A displayed delta does not establish
              that the intervention caused a change. Three observations is an
              operational minimum, not a statistical reliability guarantee.
            </p>

            <p>
              Recommendation Intelligence v1 is a deterministic baseline that
              passed its current reference-corpus gate; that gate does not
              establish general accuracy across categories, prompts, or future
              model behavior.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

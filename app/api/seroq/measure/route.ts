import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import {
  mkdir,
  writeFile,
  access,
} from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AeoResult = {
  query?: string;
  queryId?: string;
  queryText?: string;
  provider?: string;
  label?: string;
  model?: string;
  mention?: string;
  position?: number | null;
  citationCount?: number;
  canonicalCitations?: string[];
  competitors?: string[];
  presence?: {
    hits?: number;
    n?: number;
    rate?: number;
    ci?: {
      low?: number;
      high?: number;
      level?: number;
    };
  };
  trials?: unknown[];
  sentiment?: unknown;
};

function cleanDomain(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]
    .toLowerCase();
}

function safeFolder(value: string) {
  return value.replace(/[^a-z0-9.-]+/gi, "-").slice(0, 100);
}

function normalizeProvider(provider?: string) {
  switch ((provider || "").toLowerCase()) {
    case "openai":
      return "chatgpt";
    case "gemini":
      return "gemini";
    case "anthropic":
      return "claude";
    case "perplexity":
      return "perplexity";
    default:
      return provider || "unknown";
  }
}

function normalizeObservation(result: AeoResult) {
  const mention = result.mention || "error";
  const measured = mention !== "error" && mention !== "missing";

  const hits =
    typeof result.presence?.hits === "number"
      ? result.presence.hits
      : mention === "yes" || mention === "src"
        ? 1
        : 0;

  const valid =
    typeof result.presence?.n === "number"
      ? result.presence.n
      : measured
        ? 1
        : 0;

  return {
    queryId: result.queryId || null,
    query: result.queryText || result.query || "",
    platform: normalizeProvider(result.provider),
    provider: result.provider || "unknown",
    model: result.model || null,

    measurementStatus: measured ? "MEASURED" : "UNKNOWN",

    presence: {
      mention,
      hits,
      valid,
      rate: valid > 0 ? hits / valid : null,
      confidenceInterval: result.presence?.ci
        ? {
            low: result.presence.ci.low ?? null,
            high: result.presence.ci.high ?? null,
            level: result.presence.ci.level ?? null,
          }
        : null,
    },

    position:
      typeof result.position === "number" ? result.position : null,

    citations: Array.isArray(result.canonicalCitations)
      ? result.canonicalCitations
      : [],

    citationCount:
      typeof result.citationCount === "number"
        ? result.citationCount
        : Array.isArray(result.canonicalCitations)
          ? result.canonicalCitations.length
          : 0,

    competitors: Array.isArray(result.competitors)
      ? result.competitors
      : [],

    attempts: Array.isArray(result.trials)
      ? result.trials.length
      : valid > 0
        ? valid
        : 1,

    raw: result,
  };
}

function runNode(
  script: string,
  args: string[],
  cwd: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd,
      env: {
        ...process.env,
        AEO_NO_UPDATE_CHECK: "1",
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      resolve({
        code: code ?? 3,
        stdout,
        stderr,
      });
    });
  });
}

function providerConfig() {
  const providers: Record<string, object> = {};

  if (process.env.GEMINI_API_KEY) {
    providers.gemini = {
      model: "gemini-3.8-flash",
      classifyModel: "gemini-3.1-flash-lite",
      env: "GEMINI_API_KEY",
    };
  }

  if (process.env.OPENAI_API_KEY) {
    providers.openai = {
      model: "gpt-5.6-luna",
      classifyModel: "gpt-5-nano",
      env: "OPENAI_API_KEY",
    };
  }

  if (process.env.ANTHROPIC_API_KEY) {
    providers.anthropic = {
      model: "claude-sonnet-5",
      classifyModel: "claude-haiku-4-5",
      env: "ANTHROPIC_API_KEY",
    };
  }

  if (process.env.PERPLEXITY_API_KEY) {
    providers.perplexity = {
      model: "sonar-reasoning-pro",
      classifyModel: "sonar",
      env: "PERPLEXITY_API_KEY",
    };
  }

  return providers;
}

/*
 * GET = zero-cost health check.
 * Confirms Seroq can see the installed aeo-platform engine.
 */
export async function GET() {
  try {
    const root = process.cwd();

    const cli = path.join(root, "vendor", "aeo-platform", "bin", "aeo-tracker.js");

    await access(cli);

    const result = await runNode(cli, ["--version"], root);

    return NextResponse.json({
      ok: result.code === 0,
      engine: "aeo-platform",
      version: result.stdout.trim() || null,
      availableProviders: Object.keys(providerConfig()),
      spendTriggered: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        engine: "aeo-platform",
        error:
          error instanceof Error
            ? error.message
            : "Measurement engine unavailable",
        spendTriggered: false,
      },
      { status: 500 },
    );
  }
}

/*
 * POST = live measurement.
 *
 * We deliberately DO NOT auto-generate queries here yet.
 * Seroq's Buyer Journey layer will supply them.
 *
 * Provider/API errors remain UNKNOWN — never converted into absence/zero.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    const brand = String(body.brand || "").trim();
    const domain = cleanDomain(String(body.domain || ""));
    const queries = Array.isArray(body.queries)
      ? body.queries
          .map((q: unknown) => String(q).trim())
          .filter(Boolean)
      : [];

    const samples = Math.max(
      1,
      Math.min(25, Number(body.samples || 1)),
    );

    if (!brand) {
      return NextResponse.json(
        { ok: false, error: "brand is required" },
        { status: 400 },
      );
    }

    if (!domain || !domain.includes(".")) {
      return NextResponse.json(
        { ok: false, error: "valid domain is required" },
        { status: 400 },
      );
    }

    if (queries.length === 0) {
      return NextResponse.json(
        { ok: false, error: "at least one buyer query is required" },
        { status: 400 },
      );
    }

    if (queries.length > 40) {
      return NextResponse.json(
        {
          ok: false,
          error: "maximum 40 queries per Seroq run",
        },
        { status: 400 },
      );
    }

    const providers = providerConfig();

    if (Object.keys(providers).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          status: "UNKNOWN",
          error:
            "No supported provider API key is configured on the Seroq server.",
          spendTriggered: false,
        },
        { status: 503 },
      );
    }

    const root = process.cwd();

    const cli = path.join(root, "vendor", "aeo-platform", "bin", "aeo-tracker.js");

    await access(cli);

    /*
     * Preserve the raw measurement files.
     * We intentionally do NOT use a temporary folder and delete it.
     */
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    const runDir = path.join(
      root,
      "data",
      "seroq-runs",
      safeFolder(domain),
      stamp,
    );

    await mkdir(runDir, { recursive: true });

    const config = {
      brand,
      domain,
      brandAliases: Array.isArray(body.brandAliases)
        ? body.brandAliases.map(String)
        : [],
      queries,
      competitors: Array.isArray(body.competitors)
        ? body.competitors.map(String)
        : [],
      regressionThreshold: 10,
      providers,
    };

    await writeFile(
      path.join(runDir, ".aeo-tracker.json"),
      JSON.stringify(config, null, 2),
      "utf8",
    );

    /*
     * --force avoids paying for a second query-validation pass when Seroq
     * already supplied the approved buyer journeys.
     *
     * --json gives us the machine-readable summary.
     */
    const result = await runNode(
      cli,
      [
        "run",
        "--json",
        "--force",
        `--samples=${samples}`,
      ],
      runDir,
    );

    let summary: any = null;

    try {
      summary = JSON.parse(result.stdout.trim());
    } catch {
      return NextResponse.json(
        {
          ok: false,
          status: "UNKNOWN",
          exitCode: result.code,
          error: "AEO engine did not return parseable JSON.",
          stderr: result.stderr.slice(-4000),
          rawRunDirectory: runDir,
        },
        { status: 502 },
      );
    }

    const observations = Array.isArray(summary?.results)
      ? summary.results.map(normalizeObservation)
      : [];

    const measured = observations.filter(
      (o: any) => o.measurementStatus === "MEASURED",
    ).length;

    const unknown = observations.length - measured;

    /*
     * aeo-platform exit semantics:
     * 0 stable
     * 1 regression
     * 2 invisible
     * 3 provider/API failure
     *
     * 1 and 2 are VALID measurements, not server errors.
     */
    const providerFailure = result.code === 3;

    return NextResponse.json({
      ok: !providerFailure,
      status: providerFailure
        ? "UNKNOWN"
        : measured > 0
          ? "MEASURED"
          : "UNKNOWN",

      instrument: "aeo-platform",
      instrumentExitCode: result.code,

      brand,
      domain,
      samples,
      queryCount: queries.length,

      measuredObservations: measured,
      unknownObservations: unknown,

      observations,

      summary: {
        score:
          typeof summary?.score === "number"
            ? summary.score
            : null,
        hits:
          typeof summary?.mentions === "number"
            ? summary.mentions
            : null,
        total:
          typeof summary?.total === "number"
            ? summary.total
            : null,
        errors:
          typeof summary?.errors === "number"
            ? summary.errors
            : null,
        costUsd:
          typeof summary?.sessionCostUsd === "number"
            ? summary.sessionCostUsd
            : null,
      },

      rawRunDirectory: runDir,

      evidencePolicy: {
        failedCallsBecomeAbsence: false,
        rawResponsesPreserved: true,
        recommendationCausalityClaimed: false,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        status: "UNKNOWN",
        error:
          error instanceof Error
            ? error.message
            : "Measurement failed",
      },
      { status: 500 },
    );
  }
}


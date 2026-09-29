import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import {
  access,
  mkdir,
  readFile,
} from "node:fs/promises";
import path from "node:path";

import { assertPublicHttpUrl } from "@/lib/server/ssrf";

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

function safeFolder(value: string) {
  return value
    .replace(/[^a-z0-9.-]+/gi, "-")
    .slice(0, 100);
}

function brandFromDomain(domain: string) {
  const root = domain.split(".")[0] || domain;

  return root
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

  const measured =
    mention !== "error" &&
    mention !== "missing";

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
    query:
      result.queryText ||
      result.query ||
      "",

    platform: normalizeProvider(
      result.provider,
    ),

    provider:
      result.provider || "unknown",

    model:
      result.model || null,

    measurementStatus:
      measured ? "MEASURED" : "UNKNOWN",

    presence: {
      mention,
      hits,
      valid,
      rate:
        valid > 0
          ? hits / valid
          : null,

      confidenceInterval:
        result.presence?.ci
          ? {
              low:
                result.presence.ci.low ??
                null,
              high:
                result.presence.ci.high ??
                null,
              level:
                result.presence.ci.level ??
                null,
            }
          : null,
    },

    position:
      typeof result.position === "number"
        ? result.position
        : null,

    citations:
      Array.isArray(
        result.canonicalCitations,
      )
        ? result.canonicalCitations
        : [],

    citationCount:
      typeof result.citationCount ===
      "number"
        ? result.citationCount
        : Array.isArray(
              result.canonicalCitations,
            )
          ? result.canonicalCitations.length
          : 0,

    competitors:
      Array.isArray(result.competitors)
        ? result.competitors
        : [],

    attempts:
      Array.isArray(result.trials)
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
): Promise<{
  code: number;
  stdout: string;
  stderr: string;
}> {
  return new Promise(
    (resolve, reject) => {
      const child = spawn(
        process.execPath,
        [script, ...args],
        {
          cwd,
          env: {
            ...process.env,
            AEO_NO_UPDATE_CHECK: "1",
            NO_COLOR: "1",
          },
          windowsHide: true,
        },
      );

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
    },
  );
}

/* SEROQ_PROVIDER_KEY_CHECK */
function hasResearchProviderKey() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY
  );
}
export async function POST(
  request: Request,
) {
  try {
    if (!hasResearchProviderKey()) {
      return NextResponse.json(
        {
          ok: false,
          status: "UNKNOWN",
          error:
            "Seroq needs one research provider key. Configure Gemini, OpenAI, or Anthropic.",
        },
        { status: 503 },
      );
    }

    const body = await request.json();

    let rawUrl = String(
      body.url || "",
    ).trim();

    if (!rawUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: "Website URL is required.",
        },
        { status: 400 },
      );
    }

    if (
      !/^https?:\/\//i.test(rawUrl)
    ) {
      rawUrl = `https://${rawUrl}`;
    }

    const safeUrl =
      await assertPublicHttpUrl(rawUrl);

    const domain =
      safeUrl.hostname.replace(
        /^www\./i,
        "",
      );

    const brand =
      String(body.brand || "").trim() ||
      brandFromDomain(domain);

    const root = process.cwd();

    const cli = path.join(root, "vendor", "aeo-platform", "bin", "aeo-tracker.js");

    await access(cli);

    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");

    const runDir = path.join(
      root,
      "data",
      "seroq-full-scans",
      safeFolder(domain),
      stamp,
    );

    await mkdir(runDir, {
      recursive: true,
    });

    /*
     * GitHub OSS engine does the hard work:
     * - fetches site
     * - understands category
     * - generates buyer queries
     * - validates them
     * - stores project config
     */
    const init = await runNode(
      cli,
      [
        "init",
        "--yes",
        `--brand=${brand}`,
        `--domain=${domain}`,
        "--auto",
      ],
      runDir,
    );

    const configPath = path.join(
      runDir,
      ".aeo-tracker.json",
    );

    let config: any;

    try {
      config = JSON.parse(
        await readFile(
          configPath,
          "utf8",
        ),
      );
    } catch {
      return NextResponse.json(
        {
          ok: false,
          phase: "buyer-research",
          status: "UNKNOWN",
          error:
            "Buyer-journey research could not create a valid project.",
          stdout:
            init.stdout.slice(-4000),
          stderr:
            init.stderr.slice(-4000),
          spendTriggered:
            init.code !== 0,
        },
        { status: 502 },
      );
    }

    const queries = Array.isArray(
      config.queries,
    )
      ? config.queries
          .map((q: any) =>
            typeof q === "string"
              ? q
              : q?.q || "",
          )
          .filter(Boolean)
      : [];

    if (queries.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          phase: "buyer-research",
          status: "UNKNOWN",
          error:
            "No validated buyer journeys were generated.",
        },
        { status: 502 },
      );
    }

    /*
     * Now measure those SAME validated queries.
     * 1 sample today = cheapest end-to-end proof.
     */
    const measurement =
      await runNode(
        cli,
        [
          "run",
          "--json",
          "--force",
          "--samples=1",
        ],
        runDir,
      );

    let summary: any;

    try {
      summary = JSON.parse(
        measurement.stdout.trim(),
      );
    } catch {
      return NextResponse.json(
        {
          ok: false,
          phase: "measurement",
          status: "UNKNOWN",
          error:
            "Measurement engine did not return parseable JSON.",
          stdout:
            measurement.stdout.slice(
              -4000,
            ),
          stderr:
            measurement.stderr.slice(
              -4000,
            ),
          runDirectory: runDir,
        },
        { status: 502 },
      );
    }

    const observations =
      Array.isArray(summary?.results)
        ? summary.results.map(
            normalizeObservation,
          )
        : [];

    const measured =
      observations.filter(
        (o: any) =>
          o.measurementStatus ===
          "MEASURED",
      ).length;

    const unknown =
      observations.length - measured;

    /*
     * AEO exit codes 1/2 can still be valid
     * measured business outcomes.
     * Provider failure = UNKNOWN.
     */
    const providerFailure =
      measurement.code === 3;

    return NextResponse.json({
      ok: !providerFailure,

      status: providerFailure
        ? "UNKNOWN"
        : measured > 0
          ? "MEASURED"
          : "UNKNOWN",

      setup: {
        brand:
          config.brand || brand,

        domain:
          config.domain || domain,

        website:
          `https://${domain}`,

        category:
          config.category || "",

        queries,

        competitors:
          Array.isArray(
            config.competitors,
          )
            ? config.competitors
            : [],
      },

      observations,

      measurement: {
        instrument:
          "aeo-platform",

        exitCode:
          measurement.code,

        measured,
        unknown,

        samples: 1,

        costUsd:
          typeof summary
            ?.sessionCostUsd ===
          "number"
            ? summary.sessionCostUsd
            : null,
      },

      evidence: {
        rawRunDirectory: runDir,
        rawResponsesPreserved: true,
        failedCallsBecomeAbsence:
          false,
        causalityClaimed: false,
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
            : "Full Seroq scan failed.",
      },
      { status: 500 },
    );
  }
}



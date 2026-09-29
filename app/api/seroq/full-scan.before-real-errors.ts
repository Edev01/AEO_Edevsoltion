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
};

function hasResearchProviderKey() {
  return Boolean(
    process.env.GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY,
  );
}

function safeFolder(value: string) {
  return value
    .replace(/[^a-z0-9.-]+/gi, "-")
    .slice(0, 100);
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, (c) =>
    c.toUpperCase(),
  );
}

function brandFromDomain(domain: string) {
  const root =
    domain.split(".")[0] || domain;

  return titleCase(
    root
      .replace(/[-_]+/g, " ")
      .trim(),
  );
}

function escapeRegex(value: string) {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
}

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirst(
  html: string,
  regex: RegExp,
) {
  const match = html.match(regex);

  return match?.[1]
    ? stripHtml(match[1])
    : "";
}

type SiteProfile = {
  brand: string;
  category: string;
  title: string;
};

async function inspectHomepage(
  url: string,
  domain: string,
): Promise<SiteProfile> {
  const fallbackBrand =
    brandFromDomain(domain);

  try {
    const response = await fetch(url, {
      redirect: "follow",

      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Seroq/1.0)",
        Accept:
          "text/html,application/xhtml+xml",
      },

      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      return {
        brand: fallbackBrand,
        category: "business services",
        title: "",
      };
    }

    const html = await response.text();

    const title = extractFirst(
      html,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    );

    const h1 = extractFirst(
      html,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
    );

    const meta =
      extractFirst(
        html,
        /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      extractFirst(
        html,
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
      );

    const parts = title
      .split(/[|—–•·]/)
      .map((p) => p.trim())
      .filter(Boolean);

    let brand = fallbackBrand;

    if (
      parts[0] &&
      parts[0].split(/\s+/).length <= 6 &&
      parts[0].length <= 60
    ) {
      brand = parts[0];
    }

    let category =
      parts.slice(1).join(" ").trim() ||
      h1 ||
      meta ||
      "business services";

    category = category
      .replace(
        new RegExp(
          escapeRegex(brand),
          "ig",
        ),
        " ",
      )
      .replace(
        /\b(home|welcome|official site|website)\b/gi,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .replace(
        /^[\s\-–—|:]+|[\s\-–—|:]+$/g,
        "",
      )
      .trim();

    if (!category) {
      category = "business services";
    }

    if (category.length > 110) {
      category =
        category.slice(0, 110).trim();
    }

    return {
      brand,
      category,
      title,
    };
  } catch {
    return {
      brand: fallbackBrand,
      category: "business services",
      title: "",
    };
  }
}

function queryTopic(category: string) {
  let topic = category
    .replace(
      /\b(companies|company|agency|agencies|providers?|services?|solutions?)\b/gi,
      " ",
    )
    .replace(/[,:;|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (topic.length < 4) {
    topic = category.trim();
  }

  if (topic.length > 75) {
    topic = topic
      .slice(0, 75)
      .trim();
  }

  return (
    topic ||
    "business technology services"
  );
}

function fallbackQueries(
  category: string,
) {
  const topic = queryTopic(category);

  return [
    `best ${topic} companies`,
    `top ${topic} providers for businesses`,
    `which ${topic} provider should a company choose`,
  ];
}

function normalizeProvider(
  provider?: string,
) {
  switch (
    (provider || "").toLowerCase()
  ) {
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

function normalizeObservation(
  result: AeoResult,
) {
  const mention =
    result.mention || "error";

  const measured =
    mention !== "error" &&
    mention !== "missing";

  const hits =
    typeof result.presence?.hits ===
    "number"
      ? result.presence.hits
      : mention === "yes" ||
          mention === "src"
        ? 1
        : 0;

  const valid =
    typeof result.presence?.n ===
    "number"
      ? result.presence.n
      : measured
        ? 1
        : 0;

  return {
    queryId:
      result.queryId || null,

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
      measured
        ? "MEASURED"
        : "UNKNOWN",

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
                result.presence.ci
                  .low ?? null,

              high:
                result.presence.ci
                  .high ?? null,

              level:
                result.presence.ci
                  .level ?? null,
            }
          : null,
    },

    position:
      typeof result.position ===
      "number"
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
          ? result
              .canonicalCitations.length
          : 0,

    competitors:
      Array.isArray(
        result.competitors,
      )
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

      child.stdout.on(
        "data",
        (chunk) => {
          stdout +=
            chunk.toString();
        },
      );

      child.stderr.on(
        "data",
        (chunk) => {
          stderr +=
            chunk.toString();
        },
      );

      child.on(
        "error",
        reject,
      );

      child.on(
        "close",
        (code) => {
          resolve({
            code: code ?? 3,
            stdout,
            stderr,
          });
        },
      );
    },
  );
}

async function readConfig(
  file: string,
) {
  try {
    return JSON.parse(
      await readFile(
        file,
        "utf8",
      ),
    );
  } catch {
    return null;
  }
}

function queryTexts(config: any) {
  if (
    !Array.isArray(
      config?.queries,
    )
  ) {
    return [];
  }

  return config.queries
    .map((q: any) =>
      typeof q === "string"
        ? q
        : q?.q || "",
    )
    .map((q: string) =>
      q.trim(),
    )
    .filter(Boolean);
}

function parseJsonOutput(
  text: string,
) {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {}

  const lines =
    trimmed.split(/\r?\n/);

  for (
    let i = lines.length - 1;
    i >= 0;
    i--
  ) {
    const candidate = lines
      .slice(i)
      .join("\n")
      .trim();

    if (
      !candidate.startsWith("{")
    ) {
      continue;
    }

    try {
      return JSON.parse(candidate);
    } catch {}
  }

  return null;
}

function diagnostic(
  ...chunks: string[]
) {
  let text = chunks
    .filter(Boolean)
    .join("\n");

  for (const envName of [
    "GEMINI_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "PERPLEXITY_API_KEY",
  ]) {
    const secret =
      process.env[envName];

    if (secret) {
      text = text
        .split(secret)
        .join("[REDACTED]");
    }
  }

  const lines = text
    .replace(
      /\x1B\[[0-9;]*m/g,
      "",
    )
    .split(/\r?\n/)
    .map((line) =>
      line.trim(),
    )
    .filter(Boolean);

  const useful = lines.filter(
    (line) =>
      /(error|fail|auth|key|quota|billing|rate|model|blocked|invalid|research)/i.test(
        line,
      ),
  );

  return (
    useful.length
      ? useful.slice(-8)
      : lines.slice(-8)
  )
    .join(" | ")
    .slice(0, 1400);
}

export async function POST(
  request: Request,
) {
  try {
    if (
      !hasResearchProviderKey()
    ) {
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

    const body =
      await request.json();

    let rawUrl = String(
      body.url || "",
    ).trim();

    if (!rawUrl) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Website URL is required.",
        },

        { status: 400 },
      );
    }

    if (
      !/^https?:\/\//i.test(
        rawUrl,
      )
    ) {
      rawUrl =
        `https://${rawUrl}`;
    }

    const safeUrl =
      await assertPublicHttpUrl(
        rawUrl,
      );

    const domain =
      safeUrl.hostname.replace(
        /^www\./i,
        "",
      );

    /*
     * First inspect the homepage ourselves.
     * This gives Seroq a usable brand/category
     * even when the expensive auto-research
     * branch fails.
     */
    const profile =
      await inspectHomepage(
        safeUrl.toString(),
        domain,
      );

    const brand =
      String(
        body.brand || "",
      ).trim() ||
      profile.brand;

    const category =
      profile.category;

    const root =
      process.cwd();

    const cli = path.join(
      root,
      "vendor",
      "aeo-platform",
      "bin",
      "aeo-tracker.js",
    );

    await access(cli);

    const stamp =
      new Date()
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

    const configPath =
      path.join(
        runDir,
        ".aeo-tracker.json",
      );

    /*
     * PRIMARY PATH:
     * Let the upstream OSS engine research
     * and validate the buyer journeys.
     */
    const autoArgs = [
      "init",
      "--yes",
      `--brand=${brand}`,
      `--domain=${domain}`,
      "--auto",
    ];

    if (category) {
      autoArgs.push(
        `--category=${category}`,
      );
    }

    const automatic =
      await runNode(
        cli,
        autoArgs,
        runDir,
      );

    let config =
      await readConfig(
        configPath,
      );

    let queries =
      queryTexts(config);

    let researchMode =
      "auto";

    /*
     * FALLBACK PATH:
     *
     * The upstream project explicitly provides
     * --keywords for exactly this scenario.
     * It skips AI query brainstorming and accepts
     * three supplied buyer queries.
     */
    let fallbackResult:
      | {
          code: number;
          stdout: string;
          stderr: string;
        }
      | null = null;

    if (
      !config ||
      queries.length === 0
    ) {
      researchMode =
        "oss-keywords-fallback";

      const fallback =
        fallbackQueries(
          category,
        );

      fallbackResult =
        await runNode(
          cli,
          [
            "init",
            "--yes",
            `--brand=${brand}`,
            `--domain=${domain}`,
            `--keywords=${fallback.join(",")}`,
            "--force",
          ],
          runDir,
        );

      config =
        await readConfig(
          configPath,
        );

      queries =
        queryTexts(config);
    }

    if (
      !config ||
      queries.length === 0
    ) {
      const detail =
        diagnostic(
          automatic.stdout,
          automatic.stderr,
          fallbackResult?.stdout ||
            "",
          fallbackResult?.stderr ||
            "",
        );

      return NextResponse.json(
        {
          ok: false,

          phase:
            "buyer-research",

          status:
            "UNKNOWN",

          error:
            detail ||
            "Buyer-journey setup failed.",

          researchMode,
        },

        { status: 502 },
      );
    }

    /*
     * MEASURE THE EXACT QUERY BASKET.
     *
     * One sample while proving the full MVP loop.
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

    const summary =
      parseJsonOutput(
        measurement.stdout,
      );

    if (!summary) {
      return NextResponse.json(
        {
          ok: false,

          phase:
            "measurement",

          status:
            "UNKNOWN",

          error:
            diagnostic(
              measurement.stdout,
              measurement.stderr,
            ) ||
            "Measurement engine did not return valid JSON.",

          researchMode,
        },

        { status: 502 },
      );
    }

    const observations =
      Array.isArray(
        summary?.results,
      )
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
      observations.length -
      measured;

    const providerFailure =
      measurement.code === 3;

    return NextResponse.json({
      ok: !providerFailure,

      status:
        providerFailure
          ? "UNKNOWN"
          : measured > 0
            ? "MEASURED"
            : "UNKNOWN",

      setup: {
        brand:
          config.brand ||
          brand,

        domain:
          config.domain ||
          domain,

        website:
          `https://${domain}`,

        category,

        queries,

        competitors:
          Array.isArray(
            config.competitors,
          )
            ? config.competitors
            : [],

        researchMode,
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
        rawRunDirectory:
          runDir,

        rawResponsesPreserved:
          true,

        failedCallsBecomeAbsence:
          false,

        causalityClaimed:
          false,
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


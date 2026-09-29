import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileAsync = promisify(execFile);

type GeoAuditRaw = {
  url?: string;
  timestamp?: string;
  score?: number;
  band?: string;
  error?: string | null;
  checks?: Record<string, unknown>;
  [key: string]: unknown;
};

function normalizeUrl(input: string): string {
  const trimmed = input.trim();

  if (!trimmed) {
    throw new Error("URL is required");
  }

  const withProtocol =
    /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  const parsed = new URL(withProtocol);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only HTTP/HTTPS URLs are supported");
  }

  return parsed.toString();
}

async function runGeoAudit(url: string): Promise<GeoAuditRaw> {
  /*
   * Windows installs the PyPI CLI as geo.exe.
   * We invoke the professional engine directly rather than recreating
   * any of its audit logic in TypeScript.
   */
  const candidates =
    process.platform === "win32"
      ? [
          { file: "geo.exe", args: ["audit", "--url", url, "--format", "json"] },
          { file: "geo", args: ["audit", "--url", url, "--format", "json"] },
        ]
      : [
          { file: "geo", args: ["audit", "--url", url, "--format", "json"] },
        ];

  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const { stdout } = await execFileAsync(candidate.file, candidate.args, {
        windowsHide: true,
        timeout: 45000,
        maxBuffer: 10 * 1024 * 1024,
        encoding: "utf8",
      });

      return JSON.parse(stdout) as GeoAuditRaw;
    } catch (error) {
      lastError = error;

      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";

      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw lastError ?? new Error("GEO Optimizer CLI was not found");
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: unknown };

    if (typeof body.url !== "string") {
      return NextResponse.json(
        {
          status: "failed",
          certainty: "UNKNOWN",
          error: "A website URL is required.",
        },
        { status: 400 },
      );
    }

    const url = normalizeUrl(body.url);
    const raw = await runGeoAudit(url);

    /*
     * CRITICAL SEROQ RULE:
     *
     * A failed measurement is NOT a measured score of zero.
     *
     * GEO Optimizer can return a JSON document containing score: 0
     * together with an error such as Timeout (10s). Seroq must never
     * present that zero as an actual site finding.
     */
    if (raw.error) {
      return NextResponse.json({
        status: "unknown",
        certainty: "UNKNOWN",
        source: "GEO Optimizer",
        url: raw.url ?? url,
        measuredAt: raw.timestamp ?? new Date().toISOString(),
        error: raw.error,
        score: null,
        band: null,
        checks: null,
        raw,
      });
    }

    return NextResponse.json({
      status: "measured",
      certainty: "VERIFIED",
      source: "GEO Optimizer",
      url: raw.url ?? url,
      measuredAt: raw.timestamp ?? new Date().toISOString(),
      score: typeof raw.score === "number" ? raw.score : null,
      band: typeof raw.band === "string" ? raw.band : null,
      checks: raw.checks ?? {},
      raw,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "GEO audit failed";

    return NextResponse.json(
      {
        status: "failed",
        certainty: "UNKNOWN",
        source: "GEO Optimizer",
        score: null,
        band: null,
        checks: null,
        error: message,
      },
      { status: 500 },
    );
  }
}

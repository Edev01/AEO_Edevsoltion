import fs from "node:fs/promises";
import {
  existsSync,
} from "node:fs";

import path from "node:path";

import {
  execFile,
} from "node:child_process";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  classifyPresenceChange,
  derivePresenceOutcome,
} from "@/lib/server/seroq-presence-stats";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  600;


type MeasurementSummary = {
  validTrials: number;
  failedTrials: number;

  presence: {
    hits: number;
    n: number;
    rate: number;

    confidenceInterval: {
      level: number;
      method: string;
      low: number;
      high: number;
    };
  };

  generatedAt: string;
};


function runProcess(
  executable: string,
  args: string[],
  cwd: string,
  env:
    NodeJS.ProcessEnv,
): Promise<{
  stdout: string;
  stderr: string;
}> {

  return new Promise(
    (
      resolve,
      reject,
    ) => {

      execFile(
        executable,
        args,
        {
          cwd,
          env,
          timeout:
            10 * 60 * 1000,

          maxBuffer:
            10 * 1024 * 1024,

          windowsHide:
            true,
        },
        (
          error,
          stdout,
          stderr,
        ) => {

          if (
            error
          ) {

            reject(
              new Error(
                [
                  error.message,
                  stderr,
                  stdout,
                ]
                  .filter(Boolean)
                  .join("\n"),
              ),
            );

            return;

          }


          resolve({
            stdout,
            stderr,
          });

        },
      );

    },
  );

}


export async function POST(
  request:
    NextRequest,
) {

  try {

    const body =
      await request.json();


    const prompt =
      typeof body.prompt ===
      "string"
        ? body.prompt.trim()
        : "";


    const targetBrand =
      typeof body.targetBrand ===
      "string"
        ? body.targetBrand.trim()
        : "";


    const baselineHits =
      Number(
        body.baseline?.hits,
      );


    const baselineN =
      Number(
        body.baseline?.n,
      );


    if (
      !prompt ||
      !targetBrand ||
      !Number.isFinite(
        baselineHits,
      ) ||
      !Number.isFinite(
        baselineN,
      )
    ) {

      return NextResponse.json(
        {
          error:
            "Invalid remeasurement request.",
        },
        {
          status:
            400,
        },
      );

    }


    const collectorRoot =
      process.env
        .SEROQ_COLLECTOR_ROOT ??
      path.resolve(
        process.cwd(),
        "..",
        "seroq-collector",
      );


    const agentRoot =
      path.join(
        collectorRoot,
        "apps",
        "agent",
      );


    const collectorScript =
      path.join(
        agentRoot,
        "dist",
        "seroq-measure-cli.js",
      );


    if (
      !existsSync(
        collectorScript,
      )
    ) {

      return NextResponse.json(
        {
          error:
            "Compiled Seroq measurement worker not found.",
          collectorScript,
        },
        {
          status:
            500,
        },
      );

    }


    const captureDir =
      path.join(
        process.cwd(),
        "seroq-captures",
      );


    await fs.mkdir(
      captureDir,
      {
        recursive:
          true,
      },
    );


    const timestamp =
      new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          "-",
        );


    const outputFile =
      path.join(
        captureDir,
        `remeasure-${timestamp}.json`,
      );


    const childEnv:
      NodeJS.ProcessEnv = {
        ...process.env,

        ONEGLANSE_APP_MODE:
          "local",
      };


    if (
      !childEnv
        .CAMOUFOX_PYTHON_BIN
    ) {

      const localAppData =
        process.env
          .LOCALAPPDATA;


      if (
        localAppData
      ) {

        const python =
          path.join(
            localAppData,
            "Programs",
            "Python",
            "Python311",
            "python.exe",
          );


        if (
          existsSync(
            python,
          )
        ) {

          childEnv
            .CAMOUFOX_PYTHON_BIN =
            python;

        }

      }

    }


    const processResult =
      await runProcess(
        process.execPath,
        [
          collectorScript,

          "--prompt",
          prompt,

          "--target",
          targetBrand,

          "--trials",
          "5",

          "--output",
          outputFile,
        ],
        agentRoot,
        childEnv,
      );


    const raw =
      await fs.readFile(
        outputFile,
        "utf8",
      );


    const measurement =
      JSON.parse(
        raw,
      ) as MeasurementSummary;


    const before = {

      hits:
        baselineHits,

      n:
        baselineN,

    };


    const after = {

      hits:
        measurement
          .presence
          .hits,

      n:
        measurement
          .presence
          .n,

    };


    const comparison =
      classifyPresenceChange(
        before,
        after,
      );


    const outcome =
      derivePresenceOutcome(
        before,
        after,
      );


    return NextResponse.json({

      ok:
        true,

      outcome,

      measurement,

      comparison,

      outputFile,

      collectorLog:
        processResult.stdout
          .slice(
            -8000,
          ),

    });

  }
  catch (
    error
  ) {

    const message =
      error instanceof Error
        ? error.message
        : String(
            error,
          );


    return NextResponse.json(
      {
        ok:
          false,

        error:
          message,
      },
      {
        status:
          500,
      },
    );

  }

}

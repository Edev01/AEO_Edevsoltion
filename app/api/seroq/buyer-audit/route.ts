import fs from "node:fs/promises";

import {
  existsSync,
} from "node:fs";

import path from "node:path";

import {
  createHash,
} from "node:crypto";

import {
  execFile,
} from "node:child_process";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  wilson,
} from "@/lib/server/seroq-presence-stats";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration = 300;


type PromptInput = {
  text: string;
  tags?: string[];
};


type WorkerTrial = {
  provider: string;
  capturedAt: string;
  targetMentioned: boolean;
  response: string;
  sources: unknown[];
};


type WorkerFailure = {
  provider: string;
  capturedAt: string;
  error: string;
};


type WorkerResult = {
  provider: string;

  queryId: string;
  queryText: string;
  tags: string[];

  validTrials: number;
  failedTrials: number;

  trials: WorkerTrial[];
  failures: WorkerFailure[];
};


type WorkerOutput = {
  generatedAt: string;

  instrument: string;
  sessionStrategy: string;

  targetBrand: string;

  trialsPerJourney: number;

  attemptedProviders: string[];
  measuredProviders: string[];

  results: WorkerResult[];
};


function normalizeQueryText(
  text: string,
): string {

  return String(
    text ??
    "",
  )
    .normalize(
      "NFKC",
    )
    .toLowerCase()
    .replace(
      /\s+/g,
      " ",
    )
    .trim();

}


function queryIdFor(
  text: string,
): string | null {

  const normalized =
    normalizeQueryText(
      text,
    );


  if (
    !normalized
  ) {

    return null;

  }


  return (
    "q_" +
    createHash(
      "sha256",
    )
      .update(
        normalized,
        "utf8",
      )
      .digest(
        "hex",
      )
      .slice(
        0,
        12,
      )
  );

}


function selectBasket(
  prompts: PromptInput[],
  limit: number,
) {

  const seen =
    new Set<string>();


  const clean =
    prompts
      .map(
        (
          prompt,
          originalIndex,
        ) => ({

          text:
            String(
              prompt.text ??
              "",
            ).trim(),

          tags:
            Array.isArray(
              prompt.tags,
            )
              ? prompt.tags.filter(
                  (
                    tag,
                  ): tag is string =>
                    typeof tag ===
                    "string",
                )
              : [],

          originalIndex,

        }),
      )
      .filter(
        (
          prompt,
        ) =>
          prompt.text.length >=
          8,
      )
      .filter(
        (
          prompt,
        ) => {

          const normalized =
            normalizeQueryText(
              prompt.text,
            );


          if (
            seen.has(
              normalized,
            )
          ) {

            return false;

          }


          seen.add(
            normalized,
          );

          return true;

        },
      );


  clean.sort(
    (
      a,
      b,
    ) => {

      const aHigh =
        a.tags.some(
          (
            tag,
          ) =>
            tag.toLowerCase() ===
            "high",
        )
          ? 1
          : 0;


      const bHigh =
        b.tags.some(
          (
            tag,
          ) =>
            tag.toLowerCase() ===
            "high",
        )
          ? 1
          : 0;


      return (
        bHigh -
          aHigh ||
        a.originalIndex -
          b.originalIndex
      );

    },
  );


  return clean
    .slice(
      0,
      limit,
    )
    .map(
      (
        prompt,
      ) => {

        const queryId =
          queryIdFor(
            prompt.text,
          );


        if (
          !queryId
        ) {

          throw new Error(
            "Could not create stable query ID.",
          );

        }


        return {

          queryId,

          queryText:
            prompt.text,

          tags:
            prompt.tags,

        };

      },
    );

}


function runProcess(
  executable: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
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
            30 * 60 * 1000,

          windowsHide:
            true,

          maxBuffer:
            30 * 1024 * 1024,
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
                  .filter(
                    Boolean,
                  )
                  .join(
                    "\n",
                  ),
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
  request: NextRequest,
) {

  try {

    const body =
      await request.json();


    const targetBrand =
      typeof body.targetBrand ===
      "string"
        ? body.targetBrand.trim()
        : "";


    if (
      !targetBrand
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "Target brand is required.",
        },
        {
          status:
            400,
        },
      );

    }


    const requestedLimit =
      Number(
        body.maxJourneys ??
        3,
      );


    const maxJourneys =
      Number.isFinite(
        requestedLimit,
      )
        ? Math.max(
            1,
            Math.min(
              10,
              Math.floor(
                requestedLimit,
              ),
            ),
          )
        : 3;


    const rawPrompts:
      PromptInput[] =
      Array.isArray(
        body.prompts,
      )
        ? body.prompts
        : [];


    const basket =
      selectBasket(
        rawPrompts,
        maxJourneys,
      );


    if (
      basket.length ===
      0
    ) {

      return NextResponse.json(
        {
          ok:
            false,

          error:
            "No buyer journeys are available.",
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


    const workerScript =
      path.join(
        agentRoot,
        "dist",
        "seroq-batch-measure-cli.js",
      );


    if (
      !existsSync(
        workerScript,
      )
    ) {

      throw new Error(
        "Seroq multi-AI measurement worker was not found.",
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


    const batchId =
      `batch-${new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          "-",
        )}`;


    const inputFile =
      path.join(
        captureDir,
        `${batchId}-input.json`,
      );


    const workerOutputFile =
      path.join(
        captureDir,
        `${batchId}-worker.json`,
      );


    await fs.writeFile(
      inputFile,

      JSON.stringify(
        {
          targetBrand,

          prompts:
            basket,

          trialsPerJourney:
            5,
        },
        null,
        2,
      ),

      "utf8",
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

        const candidate =
          path.join(
            localAppData,
            "Programs",
            "Python",
            "Python311",
            "python.exe",
          );


        if (
          existsSync(
            candidate,
          )
        ) {

          childEnv
            .CAMOUFOX_PYTHON_BIN =
            candidate;

        }

      }

    }


    const processResult =
      await runProcess(
        process.execPath,

        [
          workerScript,

          "--input",
          inputFile,

          "--output",
          workerOutputFile,
        ],

        agentRoot,

        childEnv,
      );


    const worker =
      JSON.parse(
        await fs.readFile(
          workerOutputFile,
          "utf8",
        ),
      ) as WorkerOutput;


    /*
     * Customer-facing result is grouped by BUYER JOURNEY.
     *
     * Provider-level observations remain inside engineBreakdown and
     * raw evidence, but we do not force provider branding into the UI.
     */
    const results =
      basket.map(
        (
          journey,
        ) => {

          const engineRows =
            worker.results.filter(
              (
                result,
              ) =>
                result.queryId ===
                journey.queryId,
            );


          const trials =
            engineRows.flatMap(
              (
                result,
              ) =>
                result.trials,
            );


          const failures =
            engineRows.flatMap(
              (
                result,
              ) =>
                result.failures,
            );


          const hits =
            trials.filter(
              (
                trial,
              ) =>
                trial.targetMentioned,
            ).length;


          const n =
            trials.length;


          const interval =
            n >
            0
              ? wilson(
                  hits,
                  n,
                )
              : null;


          return {

            queryId:
              journey.queryId,

            queryText:
              journey.queryText,

            tags:
              journey.tags,

            status:
              n >
              0
                ? "OBSERVED"
                : "UNKNOWN",

            validTrials:
              n,

            failedTrials:
              failures.length,

            measuredEngineCount:
              new Set(
                trials.map(
                  (
                    trial,
                  ) =>
                    trial.provider,
                ),
              ).size,

            presence:
              n >
              0 &&
              interval
                ? {

                    hits,

                    n,

                    rate:
                      hits /
                      n,

                    confidenceInterval: {
                      level:
                        0.95,

                      method:
                        "Wilson",

                      low:
                        interval.low,

                      high:
                        interval.high,
                    },

                  }
                : null,

            /*
             * Full raw answers remain preserved.
             * Provider identity is evidence/provenance, not headline branding.
             */
            trials,

            failures,

            engineBreakdown:
              engineRows.map(
                (
                  result,
                ) => {

                  const engineHits =
                    result.trials.filter(
                      (
                        trial,
                      ) =>
                        trial.targetMentioned,
                    ).length;


                  return {

                    provider:
                      result.provider,

                    validTrials:
                      result.validTrials,

                    failedTrials:
                      result.failedTrials,

                    hits:
                      engineHits,

                    rate:
                      result.validTrials >
                      0
                        ? engineHits /
                          result.validTrials
                        : null,

                  };

                },
              ),

            evidenceFile:
              path.basename(
                workerOutputFile,
              ),

          };

        },
      );


    const totalHits =
      results.reduce(
        (
          total,
          result,
        ) =>
          total +
          (
            result.presence?.hits ??
            0
          ),
        0,
      );


    const totalTrials =
      results.reduce(
        (
          total,
          result,
        ) =>
          total +
          (
            result.presence?.n ??
            0
          ),
        0,
      );


    const overallInterval =
      totalTrials >
      0
        ? wilson(
            totalHits,
            totalTrials,
          )
        : null;


    const unknownObservations =
      worker.results.reduce(
        (
          total,
          result,
        ) =>
          total +
          result.failedTrials,
        0,
      );


    const manifest = {

      schema:
        3,

      batchId,

      generatedAt:
        worker.generatedAt,

      targetBrand,

      instrument:
        "multi-consumer-ai-ui",

      sessionStrategy:
        worker.sessionStrategy,

      providerCount:
        worker.measuredProviders.length,

      attemptedProviderCount:
        worker.attemptedProviders.length,

      /*
       * Exact provider identities stay in evidence for auditability.
       * Customer-facing surfaces use neutral AI-engine terminology.
       */
      providers:
        worker.measuredProviders,

      attemptedProviders:
        worker.attemptedProviders,

      samplesPerJourney:
        worker.trialsPerJourney,

      queryIdentityRule:
        "sha256(normalized exact question text), first 12 hex characters",

      basket,

      results,

      overall: {

        status:
          totalTrials >
          0
            ? "OBSERVED"
            : "UNKNOWN",

        hits:
          totalHits,

        n:
          totalTrials,

        rate:
          totalTrials >
          0
            ? totalHits /
              totalTrials
            : null,

        confidenceInterval:
          totalTrials >
            0 &&
          overallInterval
            ? {
                level:
                  0.95,

                method:
                  "Wilson",

                low:
                  overallInterval.low,

                high:
                  overallInterval.high,
              }
            : null,

      },

      failedJourneyCount:
        results.filter(
          (
            result,
          ) =>
            result.status ===
            "UNKNOWN",
        ).length,

      unknownObservations,

    };


    const manifestFile =
      path.join(
        captureDir,
        `${batchId}-manifest.json`,
      );


    await fs.writeFile(
      manifestFile,

      JSON.stringify(
        manifest,
        null,
        2,
      ),

      "utf8",
    );


    return NextResponse.json({

      ok:
        true,

      ...manifest,

      batchFile:
        path.basename(
          manifestFile,
        ),

      workerLog:
        processResult.stdout.slice(
          -7000,
        ),

    });

  }
  catch (
    error
  ) {

    return NextResponse.json(
      {
        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : String(
                error,
              ),
      },
      {
        status:
          500,
      },
    );

  }

}


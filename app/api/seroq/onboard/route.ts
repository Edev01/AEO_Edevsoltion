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
  assertPublicHttpUrl,
} from "@/lib/server/ssrf";

import {
  fetchWithTimeout,
} from "@/lib/server/http";


export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;


type BuyerJourney = {
  query: string;

  intent:
    | "discovery"
    | "solution"
    | "comparison"
    | "purchase"
    | "problem"
    | "decision";

  commercialValue:
    | "high"
    | "medium";
};


function normalizeUrl(
  value: string,
): string {

  const trimmed =
    value.trim();


  if (
    /^https?:\/\//i.test(
      trimmed,
    )
  ) {
    return trimmed;
  }


  return `https://${trimmed}`;

}


function decodeEntities(
  value: string,
): string {

  return value
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    );

}


function cleanText(
  html: string,
): string {

  return decodeEntities(
    html
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " ",
      )
      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " ",
      )
      .replace(
        /<svg\b[^>]*>[\s\S]*?<\/svg>/gi,
        " ",
      )
      .replace(
        /<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi,
        " ",
      )
      .replace(
        /<[^>]+>/g,
        " ",
      )
      .replace(
        /\s+/g,
        " ",
      )
      .trim(),
  );

}


function firstMatch(
  html: string,
  expressions:
    RegExp[],
): string {

  for (
    const expression of
      expressions
  ) {

    const match =
      html.match(
        expression,
      );


    if (
      match?.[1]
    ) {

      return decodeEntities(
        match[1]
          .replace(
            /\s+/g,
            " ",
          )
          .trim(),
      );

    }

  }


  return "";

}


async function fetchPublicPage(
  startingUrl: string,
) {

  let current =
    startingUrl;


  for (
    let hop = 0;
    hop < 5;
    hop += 1
  ) {

    await assertPublicHttpUrl(
      current,
    );


    const response =
      await fetchWithTimeout(
        current,
        {
          redirect:
            "manual",

          cache:
            "no-store",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; Seroq/1.0; AI visibility audit)",

            Accept:
              "text/html,application/xhtml+xml",
          },
        },
        15_000,
      );


    if (
      response.status >=
        300 &&
      response.status <
        400
    ) {

      const location =
        response.headers.get(
          "location",
        );


      if (
        !location
      ) {

        throw new Error(
          `Redirect without location (${response.status}).`,
        );

      }


      current =
        new URL(
          location,
          current,
        ).toString();


      continue;

    }


    if (
      !response.ok
    ) {

      throw new Error(
        `Website returned HTTP ${response.status}.`,
      );

    }


    return {
      finalUrl:
        current,

      html:
        (
          await response.text()
        ).slice(
          0,
          2_000_000,
        ),
    };

  }


  throw new Error(
    "Too many redirects.",
  );

}


function runProcess(
  executable: string,
  args: string[],
  cwd: string,
): Promise<void> {

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

          env: {
            ...process.env,

            ONEGLANSE_APP_MODE:
              "local",
          },

          timeout:
            5 * 60 * 1000,

          windowsHide:
            true,

          maxBuffer:
            10 * 1024 * 1024,
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


          resolve();

        },
      );

    },
  );

}


function uniqueStrings(
  value: unknown,
  limit = 20,
): string[] {

  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }


  return [
    ...new Set(
      value
        .filter(
          (
            item,
          ): item is string =>
            typeof item ===
            "string",
        )
        .map(
          (item) =>
            item.trim(),
        )
        .filter(Boolean),
    ),
  ].slice(
    0,
    limit,
  );

}


export async function POST(
  request:
    NextRequest,
) {

  try {

    const body =
      await request.json();


    const rawWebsite =
      typeof body.website ===
      "string"
        ? body.website
        : "";


    if (
      !rawWebsite.trim()
    ) {

      return NextResponse.json(
        {
          error:
            "Website is required.",
        },
        {
          status:
            400,
        },
      );

    }


    const requestedUrl =
      normalizeUrl(
        rawWebsite,
      );


    await assertPublicHttpUrl(
      requestedUrl,
    );


    const page =
      await fetchPublicPage(
        requestedUrl,
      );


    const finalUrl =
      new URL(
        page.finalUrl,
      );


    const pageTitle =
      firstMatch(
        page.html,
        [
          /<title[^>]*>([\s\S]*?)<\/title>/i,
        ],
      );


    const siteName =
      firstMatch(
        page.html,
        [
          /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["'][^>]*>/i,

          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["'][^>]*>/i,
        ],
      );


    const metaDescription =
      firstMatch(
        page.html,
        [
          /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i,

          /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i,
        ],
      );


    const homepageText =
      cleanText(
        page.html,
      ).slice(
        0,
        16_000,
      );


    if (
      homepageText.length <
      100
    ) {

      throw new Error(
        "Seroq could not obtain enough readable homepage content.",
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
        "seroq-onboard-cli.js",
      );


    if (
      !existsSync(
        collectorScript,
      )
    ) {

      throw new Error(
        "Compiled Seroq onboarding worker was not found.",
      );

    }


    const captures =
      path.join(
        process.cwd(),
        "seroq-captures",
      );


    await fs.mkdir(
      captures,
      {
        recursive:
          true,
      },
    );


    const stamp =
      new Date()
        .toISOString()
        .replace(
          /[:.]/g,
          "-",
        );


    const inputFile =
      path.join(
        captures,
        `onboard-input-${stamp}.json`,
      );


    const outputFile =
      path.join(
        captures,
        `onboard-output-${stamp}.json`,
      );


    await fs.writeFile(
      inputFile,

      JSON.stringify(
        {
          website:
            page.finalUrl,

          hostname:
            finalUrl.hostname,

          pageTitle,

          siteName,

          metaDescription,

          homepageText,
        },
        null,
        2,
      ),

      "utf8",
    );


    await runProcess(
      process.execPath,

      [
        collectorScript,

        "--input",
        inputFile,

        "--output",
        outputFile,
      ],

      agentRoot,
    );


    const analysisFile =
      JSON.parse(
        await fs.readFile(
          outputFile,
          "utf8",
        ),
      ) as {
        generatedAt: string;
        analysisInstrument: string;
        result: Record<string, unknown>;
      };


    const raw =
      analysisFile.result;


    const brandName =
      typeof raw.brandName ===
        "string" &&
      raw.brandName.trim()
        ? raw.brandName.trim()
        : (
            siteName ||
            pageTitle ||
            finalUrl.hostname
              .replace(
                /^www\./,
                "",
              )
              .split(
                ".",
              )[0]
          );


    const aliases =
      uniqueStrings(
        raw.aliases,
        10,
      );


    const forbidden =
      [
        brandName,
        finalUrl.hostname,
        finalUrl.hostname.replace(
          /^www\./,
          "",
        ),
        ...aliases,
      ]
        .map(
          (value) =>
            value
              .toLowerCase()
              .trim(),
        )
        .filter(
          (value) =>
            value.length >=
            3,
        );


    const buyerJourneys:
      BuyerJourney[] =
      Array.isArray(
        raw.buyerJourneys,
      )
        ? raw.buyerJourneys
            .filter(
              (
                item,
              ): item is Record<
                string,
                unknown
              > =>
                Boolean(
                  item &&
                  typeof item ===
                    "object",
                ),
            )
            .map(
              (item) => {

                const query =
                  typeof item.query ===
                  "string"
                    ? item.query.trim()
                    : "";


                const intentValue =
                  typeof item.intent ===
                  "string"
                    ? item.intent
                        .toLowerCase()
                        .trim()
                    : "discovery";


                const allowedIntents =
                  [
                    "discovery",
                    "solution",
                    "comparison",
                    "purchase",
                    "problem",
                    "decision",
                  ] as const;


                const intent =
                  allowedIntents.includes(
                    intentValue as
                      typeof allowedIntents[number],
                  )
                    ? (
                        intentValue as
                          typeof allowedIntents[number]
                      )
                    : "discovery";


                const commercialValue: BuyerJourney["commercialValue"] =
                  item.commercialValue ===
                  "medium"
                    ? "medium"
                    : "high";


                return {
                  query,
                  intent,
                  commercialValue,
                };

              },
            )
            .filter(
              (journey) => {

                if (
                  journey.query.length <
                  8
                ) {
                  return false;
                }


                const lower =
                  journey.query.toLowerCase();


                return !forbidden.some(
                  (term) =>
                    lower.includes(
                      term,
                    ),
                );

              },
            )
            .filter(
              (
                journey,
                index,
                all,
              ) =>
                all.findIndex(
                  (candidate) =>
                    candidate.query.toLowerCase() ===
                    journey.query.toLowerCase(),
                ) ===
                index,
            )
            .slice(
              0,
              12,
            )
        : [];


    if (
      buyerJourneys.length <
      5
    ) {

      throw new Error(
        "Onboarding analysis did not produce enough safe unbranded buyer journeys. No workspace was changed.",
      );

    }


    const competitors =
      Array.isArray(
        raw.competitors,
      )
        ? raw.competitors
            .filter(
              (
                item,
              ): item is Record<
                string,
                unknown
              > =>
                Boolean(
                  item &&
                  typeof item ===
                    "object",
                ),
            )
            .map(
              (item) => ({
                name:
                  typeof item.name ===
                  "string"
                    ? item.name.trim()
                    : "",

                reason:
                  typeof item.reason ===
                  "string"
                    ? item.reason.trim()
                    : "",
              }),
            )
            .filter(
              (item) =>
                item.name,
            )
            .slice(
              0,
              8,
            )
        : [];


    return NextResponse.json({

      ok:
        true,

      evidenceStatus:
        "OBSERVED",

      analysisStatus:
        "INFERRED",

      generatedAt:
        analysisFile.generatedAt,

      analysisInstrument:
        analysisFile.analysisInstrument,

      website:
        page.finalUrl,

      hostname:
        finalUrl.hostname,

      homepageEvidence: {
        pageTitle,
        siteName,
        metaDescription,
      },

      brandName,

      aliases,

      industry:
        typeof raw.industry ===
        "string"
          ? raw.industry.trim()
          : "Unknown",

      offerSummary:
        typeof raw.offerSummary ===
        "string"
          ? raw.offerSummary.trim()
          : "",

      geography:
        raw.geography &&
        typeof raw.geography ===
          "object"
          ? raw.geography
          : {
              value:
                "UNKNOWN",

              evidenceStatus:
                "UNKNOWN",
            },

      competitors,

      buyerJourneys,

      provenance: {
        inputFile:
          path.basename(
            inputFile,
          ),

        outputFile:
          path.basename(
            outputFile,
          ),
      },

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


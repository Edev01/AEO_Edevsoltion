import fs from "node:fs/promises";
import path from "node:path";

import {
  assertPublicHttpUrl,
} from "@/lib/server/ssrf";

import {
  fetchWithTimeout,
} from "@/lib/server/http";


export type ProofDimension =
  | "agentic-workflows"
  | "hitl-controls"
  | "evaluation-system"
  | "governance-audit"
  | "production-operations"
  | "vendor-portability";


export type VerifiedProof = {
  status: "VERIFIED";

  dimension:
    ProofDimension;

  excerpt:
    string;

  url:
    string;

  brand:
    string;

  sourceClass:
    "first-party";
};


export type ProofSourceResult = {
  url:
    string;

  status:
    "VERIFIED" |
    "UNKNOWN";

  fetchedAt:
    string;

  httpStatus?:
    number;

  error?:
    string;

  proofs:
    VerifiedProof[];
};


export type BrandProofProfile = {
  brand:
    string;

  sources:
    ProofSourceResult[];

  proofs:
    VerifiedProof[];

  successfullyReviewedSources:
    number;

  failedSources:
    number;
};


export type ProofSnapshot = {
  generatedAt:
    string;

  methodology:
    "deterministic-official-page-verification";

  profiles:
    BrandProofProfile[];
};


const CACHE_FILE =
  path.join(
    process.cwd(),
    "seroq-captures",
    "seroq-proof-snapshot.json",
  );


const CACHE_MAX_AGE_MS =
  24 * 60 * 60 * 1000;


/*
 * Official first-party pages only.
 *
 * This is SOURCE DISCOVERY configuration,
 * not evidence itself.
 *
 * A source appearing here does NOT create
 * a VERIFIED claim. The page must actually
 * fetch and contain matching evidence.
 */
const OFFICIAL_SOURCES: Record<
  string,
  {
    brand: string;
    urls: string[];
  }
> = {

  edevsolutions: {
    brand:
      "EDEV Solutions",

    urls: [
      "https://www.edevsolutions.com/",
    ],
  },


  accenture: {
    brand:
      "Accenture",

    urls: [
      "https://www.accenture.com/en-us/services/us-federal-government/generative-ai",
      "https://www.accenture.com/en/case-studies/ai-data/blueprint-responsible-ai",
      "https://www.accenture.com/en/edge/services/ai-data-automation",
    ],
  },


  bcgx: {
    brand:
      "BCG X",

    urls: [
      "https://www.bcg.com/x/the-multiplier/stop-automating-your-broken-processes",
    ],
  },


  deloitte: {
    brand:
      "Deloitte",

    urls: [
      "https://www.deloitte.com/southeast-asia/en/services/consulting/perspectives/agentic-ai-real-world-lessons.html",
    ],
  },


  epam: {
    brand:
      "EPAM",

    urls: [
      "https://www.epam.com/services/data-and-analytics/data-and-ai-services-offerings/agentic-process-transformation",
      "https://www.epam.com/about/newsroom/press-releases/2025/epam-releases-dial-3-0-an-evolution-of-open-source-genai-enterprise-platform",
    ],
  },


  thoughtworks: {
    brand:
      "Thoughtworks",

    urls: [
      "https://www.thoughtworks.com/insights/blog/machine-learning-and-ai/Evaluating-AI-agents-in-production",
      "https://www.thoughtworks.com/ai/works/technical-guide",
      "https://www.thoughtworks.com/en-us/agent/works",
    ],
  },

};


const DIMENSION_PATTERNS: Record<
  ProofDimension,
  RegExp[]
> = {

  "agentic-workflows": [
    /\bagentic\b/i,
    /\bmulti[- ]agent\b/i,
    /\bai agents?\b/i,
    /\bagent orchestration\b/i,
    /\bspeciali[sz]ed agents?\b/i,
  ],


  "hitl-controls": [
    /\bhuman[- ]in[- ]the[- ]loop\b/i,
    /\bhuman approval\b/i,
    /\bhuman oversight\b/i,
    /\bapproval gates?\b/i,
    /\bhumans? approve\b/i,
    /\bsupervised writ/i,
  ],


  "evaluation-system": [
    /\bevals?\b/i,
    /\bevaluation framework\b/i,
    /\boffline evaluation\b/i,
    /\bunit evaluations?\b/i,
    /\bregression\b/i,
    /\bbenchmark/i,
    /\btest sets?\b/i,
    /\bpersona[- ]based testing\b/i,
  ],


  "governance-audit": [
    /\bgovernance\b/i,
    /\baudit trails?\b/i,
    /\bauditability\b/i,
    /\btraceability\b/i,
    /\bpolicy guardrails?\b/i,
    /\bpermission scoping\b/i,
    /\brisk controls?\b/i,
  ],


  "production-operations": [
    /\bproduction observability\b/i,
    /\bproduction monitoring\b/i,
    /\bcontinuous monitoring\b/i,
    /\bruntime operations\b/i,
    /\bcontinuous deployment\b/i,
    /\bproduction[- ]ready\b/i,
    /\boperational observability\b/i,
  ],


  "vendor-portability": [
    /\bvendor[- ]agnostic\b/i,
    /\bmodel[- ]agnostic\b/i,
    /\bprovider[- ]agnostic\b/i,
    /\bmultiple model providers\b/i,
    /\breduce vendor dependency\b/i,
    /\bacross frameworks, models and tools\b/i,
  ],

};


function key(
  value: string,
): string {

  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      "",
    );

}


function decodeEntities(
  value: string,
): string {

  return value
    .replace(
      /&nbsp;/gi,
      " ",
    )
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
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&#x27;/gi,
      "'",
    );

}


function htmlToText(
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


function sentences(
  text: string,
): string[] {

  return (
    text.match(
      /[^.!?]{25,450}[.!?]?/g,
    ) ?? []
  )
    .map(
      (sentence) =>
        sentence
          .replace(
            /\s+/g,
            " ",
          )
          .trim(),
    )
    .filter(Boolean);

}


function evidenceFromText(
  brand: string,
  url: string,
  text: string,
): VerifiedProof[] {

  // Require obvious AI context somewhere
  // on the successfully fetched page.
  if (
    !/\b(ai|artificial intelligence|llm|agentic|agents?)\b/i.test(
      text,
    )
  ) {
    return [];
  }


  const allSentences =
    sentences(text);


  const output:
    VerifiedProof[] = [];


  for (
    const [
      dimension,
      patterns,
    ] of Object.entries(
      DIMENSION_PATTERNS,
    ) as Array<
      [
        ProofDimension,
        RegExp[],
      ]
    >
  ) {

    const match =
      allSentences.find(
        (sentence) =>
          patterns.some(
            (pattern) =>
              pattern.test(
                sentence,
              ),
          ),
      );


    if (!match) {
      continue;
    }


    output.push({

      status:
        "VERIFIED",

      dimension,

      excerpt:
        match.slice(
          0,
          420,
        ),

      url,

      brand,

      sourceClass:
        "first-party",

    });

  }


  return output;
}


async function verifySource(
  brand: string,
  url: string,
): Promise<ProofSourceResult> {

  const fetchedAt =
    new Date()
      .toISOString();


  try {

    const safe =
      await assertPublicHttpUrl(
        url,
      );


    const response =
      await fetchWithTimeout(
        safe,
        {
          method:
            "GET",

          redirect:
            "follow",

          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152 Safari/537.36",

            Accept:
              "text/html,application/xhtml+xml",
          },
        },
        15_000,
      );


    if (!response.ok) {

      return {
        url,
        status:
          "UNKNOWN",

        fetchedAt,

        httpStatus:
          response.status,

        error:
          `HTTP ${response.status}`,

        proofs: [],
      };

    }


    const html =
      (
        await response.text()
      ).slice(
        0,
        2_000_000,
      );


    const text =
      htmlToText(
        html,
      );


    if (
      text.length <
      100
    ) {

      return {
        url,
        status:
          "UNKNOWN",

        fetchedAt,

        httpStatus:
          response.status,

        error:
          "Page returned insufficient readable text",

        proofs: [],
      };

    }


    return {

      url,

      status:
        "VERIFIED",

      fetchedAt,

      httpStatus:
        response.status,

      proofs:
        evidenceFromText(
          brand,
          url,
          text,
        ),

    };

  }
  catch (
    error
  ) {

    return {

      url,

      status:
        "UNKNOWN",

      fetchedAt,

      error:
        error instanceof Error
          ? error.message
          : String(
              error,
            ),

      proofs: [],
    };

  }

}


async function verifyBrand(
  brand:
    string,

  urls:
    string[],
): Promise<BrandProofProfile> {

  const sources =
    await Promise.all(
      urls.map(
        (url) =>
          verifySource(
            brand,
            url,
          ),
      ),
    );


  const unique =
    new Map<
      string,
      VerifiedProof
    >();


  for (
    const source of sources
  ) {

    for (
      const proof of
        source.proofs
    ) {

      const identity =
        `${proof.dimension}:${proof.url}`;


      if (
        !unique.has(
          identity,
        )
      ) {

        unique.set(
          identity,
          proof,
        );

      }

    }

  }


  return {

    brand,

    sources,

    proofs:
      Array.from(
        unique.values(),
      ),

    successfullyReviewedSources:
      sources.filter(
        (source) =>
          source.status ===
          "VERIFIED",
      ).length,

    failedSources:
      sources.filter(
        (source) =>
          source.status ===
          "UNKNOWN",
      ).length,

  };

}


export async function refreshProofSnapshot(): Promise<
  ProofSnapshot
> {

  const profiles =
    await Promise.all(
      Object.values(
        OFFICIAL_SOURCES,
      ).map(
        (source) =>
          verifyBrand(
            source.brand,
            source.urls,
          ),
      ),
    );


  const snapshot:
    ProofSnapshot = {

      generatedAt:
        new Date()
          .toISOString(),

      methodology:
        "deterministic-official-page-verification",

      profiles,

  };


  await fs.mkdir(
    path.dirname(
      CACHE_FILE,
    ),
    {
      recursive:
        true,
    },
  );


  await fs.writeFile(
    CACHE_FILE,

    JSON.stringify(
      snapshot,
      null,
      2,
    ),

    "utf8",
  );


  return snapshot;
}


export async function getProofSnapshot(
  forceRefresh =
    false,
): Promise<ProofSnapshot> {

  if (
    !forceRefresh
  ) {

    try {

      const stat =
        await fs.stat(
          CACHE_FILE,
        );


      if (
        Date.now() -
          stat.mtimeMs <
        CACHE_MAX_AGE_MS
      ) {

        const raw =
          await fs.readFile(
            CACHE_FILE,
            "utf8",
          );


        return JSON.parse(
          raw,
        ) as ProofSnapshot;

      }

    }
    catch {
      // Cache missing or unreadable:
      // perform a fresh verification.
    }

  }


  return refreshProofSnapshot();

}


export function findProofProfile(
  snapshot:
    ProofSnapshot,

  brand:
    string,
): BrandProofProfile | null {

  const targetKey =
    key(
      brand,
    );


  return (
    snapshot.profiles.find(
      (profile) =>
        key(
          profile.brand,
        ) ===
        targetKey,
    ) ??
    null
  );

}

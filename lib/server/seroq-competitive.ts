import fs from "node:fs/promises";
import path from "node:path";


type RawCapture = {
  measurementStatus?: "ok" | "error";
  evidenceStatus?: string;
  instrument?: string;
  provider?: string;
  capturedAt?: string;

  targetBrand?: string;
  targetMentioned?: boolean;

  prompt?: string;
  response?: string;

  sources?: unknown[];
};


export type CompetitorEvidence = {
  name: string;

  mentions: number;
  validTrials: number;
  rate: number;

  trialFiles: string[];

  excerpts: Array<{
    fileName: string;
    text: string;
  }>;
};


export type CompetitiveSignal = {
  id: string;

  kind:
    | "recurring_competitor"
    | "target_absence";

  status: "OBSERVED";

  title: string;
  detail: string;

  currentValue: number;

  payload: Record<string, unknown>;

  evidenceFiles: string[];
};


export type CompetitiveDigest = {
  evidenceStatus: "OBSERVED";

  generatedAt: string;

  methodology:
    "deterministic-response-recurrence";

  provider: string;
  prompt: string;
  targetBrand: string;

  validTrials: number;

  target: {
    mentions: number;
    absences: number;
    rate: number;
  };

  recurringCompetitors: CompetitorEvidence[];

  allCandidates: CompetitorEvidence[];

  signals: CompetitiveSignal[];
};


const GENERIC_TERMS = new Set(
  [
    "ai",
    "llm",
    "chatgpt",
    "gpt",
    "claude",
    "gemini",
    "openai",
    "anthropic",
    "google",
    "microsoft",
    "human",
    "business",
    "businesses",
    "enterprise",
    "enterprises",
    "agency",
    "agencies",
    "consulting",
    "consultancy",
    "consultancies",
    "specialist",
    "specialists",
    "startup",
    "startups",
    "smb",
    "smbs",
    "production",
    "evaluation",
    "evaluations",
    "controls",
    "workflow",
    "workflows",
    "architecture",
    "implementation",
    "recommendation",
    "recommendations",
    "important distinction",
    "what i would look for",
    "what to require",
    "selection criteria",
  ].map((v) => v.toLowerCase()),
);


function normalizeWhitespace(
  value: string,
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}


function normalizeCandidate(
  value: string,
): string {
  return normalizeWhitespace(
    value
      .replace(/[*_`#\\]/g, "")
      .replace(
        /^[\d.)\-\s]+/,
        "",
      )
      .replace(
        /\s+[—–:-]\s+.*$/,
        "",
      )
      .replace(
        /\s+\([^)]*\)\s*$/,
        "",
      )
      .trim(),
  );
}


function candidateKey(
  value: string,
): string {
  return normalizeCandidate(value)
    .toLowerCase()
    .replace(
      /[™®©]/g,
      "",
    )
    .replace(
      /[^a-z0-9]+/g,
      " ",
    )
    .trim();
}


function looksLikeCandidate(
  value: string,
): boolean {

  const cleaned =
    normalizeCandidate(value);

  if (!cleaned) {
    return false;
  }

  const key =
    candidateKey(cleaned);

  if (!key) {
    return false;
  }

  if (
    GENERIC_TERMS.has(key)
  ) {
    return false;
  }

  if (
    cleaned.length < 2 ||
    cleaned.length > 80
  ) {
    return false;
  }

  const words =
    cleaned.split(/\s+/);

  if (
    words.length > 8
  ) {
    return false;
  }

  if (
    /^(what|why|how|when|where|which|if|for|the|and|one|important)\b/i.test(
      cleaned,
    )
  ) {
    return false;
  }

  // Require at least one capitalised/brand-like token.
  if (
    !words.some(
      (word) =>
        /^[A-Z][A-Za-z0-9&.+-]*$/.test(
          word,
        ) ||
        /^[A-Z]{2,}$/.test(
          word,
        ),
    )
  ) {
    return false;
  }

  return true;
}


function extractCandidates(
  response: string,
): Array<{
  name: string;
  excerpt: string;
}> {

  const found =
    new Map<
      string,
      {
        name: string;
        excerpt: string;
      }
    >();


  const lines =
    response
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);


  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {

    const line =
      lines[index]!;


    const patterns = [

      // ### 1. Accenture
      /^#{1,6}\s*(?:\d+[.)]\s*)?(.+?)$/,

      // 1. **Accenture** — explanation
      /^\d+[.)]\s+\*\*(.+?)\*\*(?:\s|$)/,

      // - **Accenture** — explanation
      /^[-*]\s+\*\*(.+?)\*\*(?:\s|$)/,

      // **Accenture** — explanation
      /^\*\*(.+?)\*\*(?:\s+[—–:-]|\s*$)/,

      // 1. Accenture — explanation
      /^\d+[.)]\s+(.+?)(?:\s+[—–:-]\s+|$)/,

    ];


    for (
      const pattern of patterns
    ) {

      const match =
        line.match(pattern);

      if (!match?.[1]) {
        continue;
      }

      const name =
        normalizeCandidate(
          match[1],
        );

      if (
        !looksLikeCandidate(
          name,
        )
      ) {
        continue;
      }

      const key =
        candidateKey(name);

      if (!key) {
        continue;
      }


      const nextLine =
        lines[index + 1] ?? "";

      const excerpt =
        normalizeWhitespace(
          [
            line,
            nextLine,
          ]
            .filter(Boolean)
            .join(" "),
        )
          .slice(
            0,
            420,
          );


      if (
        !found.has(key)
      ) {

        found.set(
          key,
          {
            name,
            excerpt,
          },
        );

      }

    }

  }


  return [
    ...found.values(),
  ];
}


async function loadCaptures() {

  const captureDir =
    path.join(
      process.cwd(),
      "seroq-captures",
    );


  let names: string[];

  try {

    names =
      await fs.readdir(
        captureDir,
      );

  }
  catch {

    return {
      captureDir,
      captures: [],
    };

  }


  const captures: Array<{
    fileName: string;
    data: RawCapture;
  }> = [];


  for (
    const fileName of names
  ) {

    const lower =
      fileName.toLowerCase();


    if (
      !lower.endsWith(".json") ||
      lower.endsWith("-summary.json") ||
      lower.endsWith("-competitive.json") ||
      lower.includes("-error-")
    ) {
      continue;
    }


    try {

      const raw =
        await fs.readFile(
          path.join(
            captureDir,
            fileName,
          ),
          "utf8",
        );


      const data =
        JSON.parse(
          raw,
        ) as RawCapture;


      if (
        data.provider !==
          "chatgpt" ||
        !data.prompt ||
        !data.response ||
        data.measurementStatus ===
          "error"
      ) {
        continue;
      }


      captures.push({
        fileName,
        data,
      });

    }
    catch {
      // Malformed/unrelated JSON is ignored,
      // never converted into a negative measurement.
    }

  }


  return {
    captureDir,
    captures,
  };
}


export async function buildCompetitiveDigest(): Promise<
  CompetitiveDigest | null
> {

  const {
    captureDir,
    captures,
  } =
    await loadCaptures();


  if (
    captures.length === 0
  ) {
    return null;
  }


  // Use latest prompt cohort only.
  const latest =
    [...captures]
      .sort(
        (a, b) =>
          Date.parse(
            b.data.capturedAt ??
              "",
          ) -
          Date.parse(
            a.data.capturedAt ??
              "",
          ),
      )[0];


  if (!latest) {
    return null;
  }


  const prompt =
    latest.data.prompt!;

  const provider =
    latest.data.provider ??
    "chatgpt";

  const targetBrand =
    latest.data.targetBrand ??
    "Target brand";


  const cohort =
    captures.filter(
      ({ data }) =>
        data.prompt === prompt &&
        data.provider ===
          provider,
    );


  const validTrials =
    cohort.length;


  const targetKey =
    candidateKey(
      targetBrand,
    );


  const targetAliases =
    new Set(
      [
        targetKey,
        candidateKey(
          targetBrand.replace(
            /\bsolutions?\b/i,
            "",
          ),
        ),
      ].filter(Boolean),
    );


  const targetMentions =
    cohort.filter(
      ({ data }) => {

        if (
          typeof data.targetMentioned ===
          "boolean"
        ) {
          return data.targetMentioned;
        }

        const body =
          data.response ?? "";

        return Array.from(
          targetAliases,
        ).some(
          (alias) =>
            alias &&
            body
              .toLowerCase()
              .includes(alias),
        );

      },
    ).length;


  const candidateMap =
    new Map<
      string,
      {
        displayName: string;
        trialFiles: Set<string>;
        excerpts: Array<{
          fileName: string;
          text: string;
        }>;
      }
    >();


  for (
    const {
      fileName,
      data,
    } of cohort
  ) {

    const candidates =
      extractCandidates(
        data.response!,
      );


    for (
      const candidate of candidates
    ) {

      const key =
        candidateKey(
          candidate.name,
        );


      if (
        !key ||
        targetAliases.has(key)
      ) {
        continue;
      }


      const existing =
        candidateMap.get(key) ?? {
          displayName:
            candidate.name,

          trialFiles:
            new Set<string>(),

          excerpts: [],
        };


      existing.trialFiles.add(
        fileName,
      );


      if (
        existing.excerpts.length <
        5
      ) {

        existing.excerpts.push({
          fileName,
          text:
            candidate.excerpt,
        });

      }


      candidateMap.set(
        key,
        existing,
      );

    }

  }


  const allCandidates =
    Array.from(
      candidateMap.values(),
    )
      .map(
        (
          candidate,
        ): CompetitorEvidence => ({

          name:
            candidate.displayName,

          mentions:
            candidate
              .trialFiles
              .size,

          validTrials,

          rate:
            validTrials > 0
              ? candidate
                  .trialFiles
                  .size /
                validTrials
              : 0,

          trialFiles:
            Array.from(
              candidate
                .trialFiles,
            ),

          excerpts:
            candidate.excerpts,

        }),
      )
      .sort(
        (a, b) =>
          b.mentions -
            a.mentions ||
          a.name.localeCompare(
            b.name,
          ),
      );


  // Recurrence threshold:
  // at least 2 independent measured answers.
  //
  // We deliberately do NOT call a one-off name
  // a recurring competitor.
  const recurringCompetitors =
    allCandidates.filter(
      (candidate) =>
        candidate.mentions >=
        2,
    );


  const signals: CompetitiveSignal[] =
    [];


  signals.push({
    id:
      "target-absence:" +
      candidateKey(
        targetBrand,
      ),

    kind:
      "target_absence",

    status:
      "OBSERVED",

    title:
      `${targetBrand} appeared in ${targetMentions}/${validTrials} measured responses`,

    detail:
      targetMentions === 0
        ? `The target was not observed in any valid response for this buyer journey.`
        : `The target appeared inconsistently across the measured responses.`,

    currentValue:
      validTrials > 0
        ? targetMentions /
          validTrials
        : 0,

    payload: {
      targetBrand,
      mentions:
        targetMentions,
      validTrials,
      prompt,
      provider,
    },

    evidenceFiles:
      cohort.map(
        (item) =>
          item.fileName,
      ),
  });


  for (
    const competitor of
      recurringCompetitors
  ) {

    signals.push({
      id:
        "recurring-competitor:" +
        candidateKey(
          competitor.name,
        ),

      kind:
        "recurring_competitor",

      status:
        "OBSERVED",

      title:
        `${competitor.name} appeared in ${competitor.mentions}/${validTrials} measured responses`,

      detail:
        `This name recurred in independently sampled responses to the same commercial buyer journey.`,

      currentValue:
        competitor.rate,

      payload: {
        competitorName:
          competitor.name,

        mentions:
          competitor.mentions,

        validTrials,

        rate:
          competitor.rate,

        prompt,
        provider,
      },

      evidenceFiles:
        competitor.trialFiles,
    });

  }


  const digest: CompetitiveDigest = {

    evidenceStatus:
      "OBSERVED",

    generatedAt:
      new Date()
        .toISOString(),

    methodology:
      "deterministic-response-recurrence",

    provider,
    prompt,
    targetBrand,

    validTrials,

    target: {
      mentions:
        targetMentions,

      absences:
        validTrials -
        targetMentions,

      rate:
        validTrials > 0
          ? targetMentions /
            validTrials
          : 0,
    },

    recurringCompetitors,

    allCandidates,

    signals,

  };


  await fs.writeFile(
    path.join(
      captureDir,
      "chatgpt-edev-agentic-ai-competitive.json",
    ),

    JSON.stringify(
      digest,
      null,
      2,
    ),

    "utf8",
  );


  return digest;
}


export async function readCompetitiveDigest(): Promise<
  CompetitiveDigest | null
> {

  const file =
    path.join(
      process.cwd(),
      "seroq-captures",
      "chatgpt-edev-agentic-ai-competitive.json",
    );


  try {

    const raw =
      await fs.readFile(
        file,
        "utf8",
      );

    return JSON.parse(
      raw,
    ) as CompetitiveDigest;

  }
  catch {

    return buildCompetitiveDigest();

  }
}


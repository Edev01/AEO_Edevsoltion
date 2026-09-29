import fs from "node:fs/promises";
import path from "node:path";

export type SeroqCaptureSource = {
  url?: string;
  title?: string;
};

export type SeroqCapture = {
  evidenceStatus?: "OBSERVED" | "VERIFIED" | "INFERRED" | "UNKNOWN";
  instrument?: string;
  provider?: string;
  capturedAt?: string;
  targetBrand?: string;
  targetMentioned?: boolean;
  prompt?: string;
  response?: string;
  sources?: SeroqCaptureSource[];
};

export type SeroqObservationIntelligence = {
  capture: SeroqCapture;
  metrics: {
    targetPresent: boolean;
    sourceCount: number;
    responseLength: number;
  };
  findings: Array<{
    status: "OBSERVED" | "VERIFIED" | "INFERRED" | "UNKNOWN";
    title: string;
    detail: string;
  }>;
};

function captureDirectory() {
  return path.join(process.cwd(), "seroq-captures");
}

export async function listSeroqCaptures(): Promise<string[]> {
  const dir = captureDirectory();

  try {
    const files = await fs.readdir(dir);

    return files
      .filter((file) => {
        const lower = file.toLowerCase();

        return (
          lower.endsWith(".json") &&
          !lower.endsWith("-summary.json") &&
          !lower.includes("-error-")
        );
      })
      .sort();
  } catch {
    return [];
  }
}

export async function readSeroqCapture(
  fileName: string,
): Promise<SeroqCapture | null> {
  const safeName = path.basename(fileName);

  if (!safeName.toLowerCase().endsWith(".json")) {
    return null;
  }

  const filePath = path.join(captureDirectory(), safeName);

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as SeroqCapture;
  } catch {
    return null;
  }
}

export async function readLatestSeroqCapture(): Promise<{
  fileName: string;
  intelligence: SeroqObservationIntelligence;
} | null> {
  const files = await listSeroqCaptures();

  if (files.length === 0) {
    return null;
  }

  const entries = await Promise.all(
    files.map(async (fileName) => {
      const capture = await readSeroqCapture(fileName);

      return capture
        ? {
            fileName,
            capture,
            time: capture.capturedAt
              ? new Date(capture.capturedAt).getTime()
              : 0,
          }
        : null;
    }),
  );

  const valid = entries
    .filter(
      (
        item,
      ): item is {
        fileName: string;
        capture: SeroqCapture;
        time: number;
      } => Boolean(item),
    )
    .sort((a, b) => b.time - a.time);

  const latest = valid[0];

  if (!latest) {
    return null;
  }

  const capture = latest.capture;

  const targetPresent = Boolean(capture.targetMentioned);
  const sourceCount = capture.sources?.length ?? 0;
  const responseLength = capture.response?.length ?? 0;
  const target = capture.targetBrand || "Target brand";
  const provider = capture.provider || "AI platform";

  const findings: SeroqObservationIntelligence["findings"] = [
    {
      status: "OBSERVED",
      title: targetPresent
        ? `${target} appeared in the answer`
        : `${target} was absent from the answer`,
      detail: targetPresent
        ? `${provider} mentioned the target brand in this captured buyer journey.`
        : `${provider} completed this buyer-oriented query without surfacing the target brand.`,
    },
    {
      status: "OBSERVED",
      title:
        sourceCount > 0
          ? `${sourceCount} source${sourceCount === 1 ? "" : "s"} captured`
          : "No extractable source URLs captured",
      detail:
        sourceCount > 0
          ? "These sources were captured from the consumer AI interface and can be inspected as evidence."
          : "Seroq will not invent citation evidence. This observation remains useful for visibility measurement, but citation-level WHY analysis is unavailable from this run.",
    },
    {
      status: targetPresent ? "OBSERVED" : "INFERRED",
      title: targetPresent
        ? "No recommendation gap established in this observation"
        : "Potential recommendation gap",
      detail: targetPresent
        ? "The target appeared, so this individual observation does not establish an absence gap."
        : "Because the target was absent from a commercially relevant buyer query, this is a candidate opportunity for further repeated sampling and evidence comparison. It does not by itself prove why the omission occurred.",
    },
  ];

  return {
    fileName: latest.fileName,
    intelligence: {
      capture,
      metrics: {
        targetPresent,
        sourceCount,
        responseLength,
      },
      findings,
    },
  };
}


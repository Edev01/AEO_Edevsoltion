import fs from "node:fs/promises";
import path from "node:path";

export type SeroqMeasurementTrial = {
  fileName: string;
  capturedAt?: string;
  targetMentioned: boolean;
  sourceCount: number;
};

export type SeroqMeasurementSummary = {
  methodology: string;
  evidenceStatus: string;
  provider: string;
  instrument: string;

  targetBrand: string;
  prompt: string;

  validTrials: number;
  failedTrials: number;

  mentions: number;
  absences: number;

  presence: {
    hits: number;
    n: number;
    rate: number;

    confidenceInterval: {
      level: number;
      low: number;
      high: number;
      method: string;
    };
  };

  interpretation: string;

  trials: SeroqMeasurementTrial[];

  generatedAt: string;
};

function captureDirectory() {
  return path.join(
    process.cwd(),
    "seroq-captures",
  );
}

export async function readLatestMeasurementSummary(): Promise<{
  fileName: string;
  summary: SeroqMeasurementSummary;
} | null> {
  const dir = captureDirectory();

  let files: string[];

  try {
    files = await fs.readdir(dir);
  } catch {
    return null;
  }

  const candidates = files.filter(
    (file) =>
      file
        .toLowerCase()
        .endsWith("-summary.json"),
  );

  if (candidates.length === 0) {
    return null;
  }

  const loaded = await Promise.all(
    candidates.map(async (fileName) => {
      try {
        const filePath =
          path.join(dir, fileName);

        const raw =
          await fs.readFile(
            filePath,
            "utf8",
          );

        const summary =
          JSON.parse(
            raw,
          ) as SeroqMeasurementSummary;

        const stat =
          await fs.stat(filePath);

        return {
          fileName,
          summary,
          modifiedAt:
            stat.mtimeMs,
        };
      } catch {
        return null;
      }
    }),
  );

  const valid = loaded
    .filter(
      (
        item,
      ): item is {
        fileName: string;
        summary: SeroqMeasurementSummary;
        modifiedAt: number;
      } => item !== null,
    )
    .sort(
      (a, b) =>
        b.modifiedAt -
        a.modifiedAt,
    );

  const latest = valid[0];

  if (!latest) {
    return null;
  }

  return {
    fileName:
      latest.fileName,

    summary:
      latest.summary,
  };
}

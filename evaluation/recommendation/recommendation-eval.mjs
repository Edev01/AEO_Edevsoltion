import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyRecommendation, RECOMMENDATION_LABELS } from "../../lib/seroq/intelligence/recommendation-core.mjs";

const [, , sourcePathArg, goldPathArg] = process.argv;

if (!sourcePathArg || !goldPathArg) {
  console.error("Usage: node recommendation-eval.mjs <source.json> <gold.json>");
  process.exit(2);
}

const sourcePath = path.resolve(sourcePathArg);
const goldPath = path.resolve(goldPathArg);

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, ""));
const gold = JSON.parse(fs.readFileSync(goldPath, "utf8").replace(/^\uFEFF/, ""));

const goldById = new Map(gold.labels.map((row) => [row.observationId, row]));
const predictions = [];

for (const observation of source.observations ?? []) {
  const reference = goldById.get(observation.observationId);
  if (!reference) continue;

  const prediction = classifyRecommendation({
    targetBrand: source.targetBrand,
    queryText: observation.queryText,
    responseText: observation.response,
  });

  predictions.push({
    observationId: observation.observationId,
    provider: observation.provider,
    queryId: observation.queryId,
    gold: reference.goldLabel,
    predicted: prediction.label,
    confidence: prediction.confidence,
    evidence: prediction.evidence,
  });
}

function safeDiv(a, b) {
  return b ? a / b : 0;
}

const evaluatedLabels = RECOMMENDATION_LABELS.filter(
  (label) =>
    label !== "UNCLASSIFIED" &&
    predictions.some((row) => row.gold === label),
);

const perClass = [];
for (const label of evaluatedLabels) {
  const tp = predictions.filter((row) => row.gold === label && row.predicted === label).length;
  const fp = predictions.filter((row) => row.gold !== label && row.predicted === label).length;
  const fn = predictions.filter((row) => row.gold === label && row.predicted !== label).length;
  const support = predictions.filter((row) => row.gold === label).length;

  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  perClass.push({ label, support, precision, recall, f1 });
}

const correct = predictions.filter((row) => row.gold === row.predicted).length;
const accuracy = safeDiv(correct, predictions.length);
const macroF1 = perClass.length
  ? perClass.reduce((sum, row) => sum + row.f1, 0) / perClass.length
  : 0;

const confusion = {};
for (const row of predictions) {
  confusion[row.gold] ??= {};
  confusion[row.gold][row.predicted] = (confusion[row.gold][row.predicted] ?? 0) + 1;
}

const mismatches = predictions.filter((row) => row.gold !== row.predicted);

const controls = [
  {
    name: "primary",
    targetBrand: "Acme",
    queryText: "Which tool is easiest for a beginner?",
    responseText: "For a beginner, Acme is the easiest starting point. Bottom line: choose Acme for the shortest learning curve.",
    expected: "PRIMARY_RECOMMENDATION",
  },
  {
    name: "shortlist",
    targetBrand: "Acme",
    queryText: "What are the best tools?",
    responseText: "Top options include Acme, Beta, and Gamma. Choose Acme if you want simplicity, Beta for automation, or Gamma for enterprise use.",
    expected: "SHORTLISTED",
  },
  {
    name: "qualified",
    targetBrand: "Acme",
    queryText: "Which tool is easiest for a beginner?",
    responseText: "For a beginner, **Beta** is usually the easiest starting point. Acme is cleaner if you find Beta cluttered.",
    expected: "COMPARISON_OR_QUALIFIED",
  },
  {
    name: "ordinary",
    targetBrand: "Acme",
    queryText: "What are the best tools?",
    responseText: "Acme launched a new editor this year. If you want a recommendation, choose Beta or Gamma.",
    expected: "ORDINARY_MENTION",
  },
  {
    name: "cautionary",
    targetBrand: "Acme",
    queryText: "What tool should a solo beginner use?",
    responseText: "Acme can work, but it is overkill for a solo beginner and is only worth considering if you need enterprise controls.",
    expected: "CAUTIONARY",
  },
  {
    name: "negative",
    targetBrand: "Acme",
    queryText: "What tool should a solo beginner use?",
    responseText: "I would avoid Acme for this use case; it is a poor choice for a solo beginner.",
    expected: "NEGATIVE",
  },
  {
    name: "absent",
    targetBrand: "Acme",
    queryText: "What are the best tools?",
    responseText: "Beta and Gamma are the strongest options for this use case.",
    expected: "ABSENT",
  },
];

const controlResults = controls.map((fixture) => {
  const result = classifyRecommendation(fixture);
  return {
    name: fixture.name,
    expected: fixture.expected,
    predicted: result.label,
    pass: fixture.expected === result.label,
  };
});

const controlsPass = controlResults.every((row) => row.pass);

const result = {
  schema: 1,
  source: path.basename(sourcePath),
  gold: path.basename(goldPath),
  observations: predictions.length,
  correct,
  accuracy,
  macroF1,
  perClass,
  mismatches,
  confusion,
  controls: controlResults,
  controlsPass,
  limitations: gold.limitations ?? [],
  gate: {
    requiredAccuracy: 0.9,
    requiredMacroF1: 0.8,
    realCorpusPass: accuracy >= 0.9 && macroF1 >= 0.8,
    controlsPass,
    passed: accuracy >= 0.9 && macroF1 >= 0.8 && controlsPass,
    note:
      "Passing this gate validates only the current reference corpus and synthetic control behavior. It does not establish general performance across categories.",
  },
};

console.log(JSON.stringify(result, null, 2));

const outputPath = path.join(
  path.dirname(sourcePath),
  "seroq-recommendation-eval-result.json",
);
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), "utf8");
console.error(`\nSaved: ${outputPath}`);


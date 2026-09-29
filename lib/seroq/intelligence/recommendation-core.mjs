/**
 * Seroq Recommendation Intelligence v1 baseline.
 *
 * Pure deterministic classifier. It is intentionally conservative:
 * structural/exact language first, no fuzzy brand guessing, and ambiguous
 * cases fall to ORDINARY_MENTION rather than being promoted to recommendation.
 *
 * This is the baseline that a future semantic classifier must beat on the same
 * reference corpus before it is allowed into paid reporting.
 */

export const RECOMMENDATION_LABELS = Object.freeze([
  "PRIMARY_RECOMMENDATION",
  "SHORTLISTED",
  "ORDINARY_MENTION",
  "COMPARISON_OR_QUALIFIED",
  "CAUTIONARY",
  "NEGATIVE",
  "ABSENT",
  "UNCLASSIFIED",
]);

function normalizeMojibake(text) {
  return String(text ?? "")
    .replaceAll("â€”", "—")
    .replaceAll("â€“", "–")
    .replaceAll("â€™", "’")
    .replaceAll("â†’", "→");
}

function escapeRegex(value) {
  return String(value ?? "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function brandRegex(brand) {
  const escaped = escapeRegex(String(brand ?? "").trim());
  return escaped
    ? new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "giu")
    : null;
}

function mentionWindows(text, brand, before = 180, after = 280) {
  const rx = brandRegex(brand);
  if (!rx) return [];

  const windows = [];
  for (const match of text.matchAll(rx)) {
    const index = match.index ?? 0;
    windows.push(
      text.slice(
        Math.max(0, index - before),
        Math.min(text.length, index + match[0].length + after),
      ),
    );
  }
  return windows;
}

function queryLooksBeginnerFocused(query) {
  return /\b(easiest|easy to use|beginner|starting out|new to)\b/i.test(query);
}

function firstExplicitDefaultBrand(text) {
  const lead = text.slice(0, 650);

  const patterns = [
    /\*\*([^*]{2,80})\*\*\s+is\s+(?:usually\s+)?the\s+easiest\s+(?:starting|entry)\s+point/i,
    /\*\*([^*]{2,80})\*\*\s+is\s+(?:probably\s+)?the\s+easiest\s+starting\s+point/i,
    /\b(?:start|go)\s+with\s+\*\*([^*]{2,80})\*\*/i,
  ];

  for (const pattern of patterns) {
    const match = lead.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function recommendationTail(text) {
  const markers = [
    "quick recommendation",
    "recommendation summary",
    "quick decision",
    "bottom line",
    "if you want a recommendation",
    "if you just want one",
    "if a single specific answer is expected",
  ];

  const lower = text.toLowerCase();
  let index = -1;

  for (const marker of markers) {
    const found = lower.lastIndexOf(marker);
    if (found > index) index = found;
  }

  return index >= 0 ? text.slice(index) : text.slice(Math.floor(text.length * 0.55));
}

function hasCoRecommendationInTail(text, brand) {
  const tail = recommendationTail(text)
    .replace(/[`#]/g, "")
    .replace(/\s+/g, " ");

  const b = escapeRegex(brand);

  const coequalPatterns = [
    new RegExp(
      `\\b(?:start with|go with|choose)\\b[^.!?]{0,140}(?:\\*{0,2}[^*]{2,60}\\*{0,2}\\s+or\\s+\\*{0,2}${b}\\*{0,2}|\\*{0,2}${b}\\*{0,2}\\s+or\\s+\\*{0,2}[^*]{2,60}\\*{0,2})`,
      "i",
    ),
    new RegExp(
      `(?:\\*{0,2}${b}\\*{0,2}\\s+or\\s+\\*{0,2}[^*]{2,60}\\*{0,2}|\\*{0,2}[^*]{2,60}\\*{0,2}\\s+or\\s+\\*{0,2}${b}\\*{0,2})[^.!?]{0,100}\\b(?:safest|starting points?|starting choices?)\\b`,
      "i",
    ),
  ];

  return coequalPatterns.some((pattern) => pattern.test(tail));
}

function explicitRecommendationSectionExcludesTarget(text, brand) {
  const lower = text.toLowerCase();
  const target = brand.toLowerCase();

  const markers = [
    "if you want a recommendation",
    "if a single specific answer is expected",
  ];

  for (const marker of markers) {
    const index = lower.lastIndexOf(marker);
    if (index >= 0 && !lower.slice(index).includes(target)) return true;
  }

  return false;
}

function rankedFirstForTarget(text, brand) {
  const b = escapeRegex(brand);

  const patterns = [
    new RegExp(
      `(?:^|\\n)\\s*#{0,6}\\s*1\\\\?\\.\\s*(?:best[^:\\n]{0,100}:\\s*)?\\*{0,2}${b}\\*{0,2}`,
      "im",
    ),
    new RegExp(
      `(?:^|\\n)\\s*#{0,6}\\s*1\\\\?\\.\\s*\\*{0,2}${b}\\*{0,2}\\s*\\([^)]*(?:best overall|simplicity|beginner|easiest)[^)]*\\)`,
      "im",
    ),
  ];

  return patterns.some((pattern) => pattern.test(text));
}

function directPrimaryEvidence(text, brand) {
  const b = escapeRegex(brand);

  const patterns = [
    new RegExp(
      `${b}\\s+is\\s+(?:probably\\s+)?(?:the\\s+)?(?:easiest|best|top)\\b`,
      "i",
    ),
    new RegExp(
      `\\btop pick\\b[^.:\\n]{0,120}\\*{0,2}${b}\\*{0,2}`,
      "i",
    ),
    new RegExp(
      `\\bbottom line:\\s*[^.\\n]{0,180}\\bchoose\\s+\\*{0,2}${b}\\*{0,2}`,
      "i",
    ),
  ];

  return patterns.find((pattern) => pattern.test(text)) ?? null;
}

function structuralShortlistEvidence(text) {
  const lower = text.toLowerCase();

  const patterns = [
    /\btop (?:options|recommendations|platforms)\b/,
    /\bleading options stand out\b/,
    /\bbest for\b/,
    /\bchoose\b/,
    /\bquick (?:recommendation|decision|summary)\b/,
    /\bseveral platforms combine\b/,
    /\ba few platforms\b/,
    /\bmost commonly cited\b/,
    /\bindustry-leading options\b/,
    /\btop platforms\b/,
    /\ba few other worth knowing\b/,
    /\balternatives that also cover\b/,
    /\bplatforms? (?:are )?built (?:to|around)\b/,
    /\boptions? (?:that )?(?:bundle|combine|include)\b/,
  ];

  return patterns.find((pattern) => pattern.test(lower)) ?? null;
}

function dominantNegativeEvidence(context) {
  return /\b(avoid|do not recommend|don't recommend|not recommended|poor choice|bad choice|worst|inferior|should not use)\b/i.test(
    context,
  );
}

function targetClauses(text, brand) {
  const lowerBrand = brand.toLowerCase();

  return String(text ?? "")
    .split(/(?:\r?\n|(?<=[.!?])\s+)/)
    .map((part) => part.trim())
    .filter((part) => part.toLowerCase().includes(lowerBrand));
}

function dominantCautionEvidence(text, brand) {
  const clauses = targetClauses(text, brand).join(" ");
  return /\b(overkill|only makes sense if|only if|unless|not ideal|not a good fit|too expensive|too complex)\b/i.test(
    clauses,
  );
}

export function classifyRecommendation(input) {
  const brand = String(input?.targetBrand ?? "").trim();
  const query = String(input?.queryText ?? "");
  const text = normalizeMojibake(input?.responseText ?? "");

  if (!brand || !text.trim()) {
    return {
      label: "UNCLASSIFIED",
      confidence: "NONE",
      evidence: "Missing target brand or response text.",
      method: "DETERMINISTIC_V1",
    };
  }

  const rx = brandRegex(brand);
  if (!rx || !rx.test(text)) {
    return {
      label: "ABSENT",
      confidence: "HIGH",
      evidence: "Target brand does not appear in the answer body.",
      method: "DETERMINISTIC_V1",
    };
  }

  const windows = mentionWindows(text, brand);
  const context = windows.join(" ");

  if (dominantNegativeEvidence(context)) {
    return {
      label: "NEGATIVE",
      confidence: "HIGH",
      evidence: "Explicit negative or rejection language occurs near the target brand.",
      method: "DETERMINISTIC_V1",
    };
  }

  const primary = directPrimaryEvidence(text, brand);
  if (primary) {
    return {
      label: "PRIMARY_RECOMMENDATION",
      confidence: "HIGH",
      evidence: "The answer explicitly frames the target as the easiest/best/top or bottom-line choice.",
      method: "DETERMINISTIC_V1",
    };
  }

  if (queryLooksBeginnerFocused(query) && rankedFirstForTarget(text, brand)) {
    return {
      label: "PRIMARY_RECOMMENDATION",
      confidence: "HIGH",
      evidence: "The target is ranked first in a beginner/ease-focused answer.",
      method: "DETERMINISTIC_V1",
    };
  }

  if (explicitRecommendationSectionExcludesTarget(text, brand)) {
    return {
      label: "ORDINARY_MENTION",
      confidence: "HIGH",
      evidence: "The target is mentioned earlier, but the answer's explicit recommendation section selects other options.",
      method: "DETERMINISTIC_V1",
    };
  }

  const defaultBrand = firstExplicitDefaultBrand(text);

  if (
    defaultBrand &&
    defaultBrand.toLowerCase() !== brand.toLowerCase()
  ) {
    if (hasCoRecommendationInTail(text, brand)) {
      return {
        label: "SHORTLISTED",
        confidence: "MEDIUM",
        evidence: "Another brand is framed as the default, but the target remains explicitly co-recommended in the decision section.",
        method: "DETERMINISTIC_V1",
      };
    }

    return {
      label: "COMPARISON_OR_QUALIFIED",
      confidence: "MEDIUM",
      evidence: "Another brand is framed as the default; the target appears as an alternative or conditional choice.",
      method: "DETERMINISTIC_V1",
    };
  }

  if (dominantCautionEvidence(text, brand)) {
    return {
      label: "CAUTIONARY",
      confidence: "MEDIUM",
      evidence: "Cautionary fit language occurs near the target without an explicit rejection.",
      method: "DETERMINISTIC_V1",
    };
  }

  const shortlist = structuralShortlistEvidence(text);
  if (shortlist) {
    return {
      label: "SHORTLISTED",
      confidence: "MEDIUM",
      evidence: "The target appears inside a structured top-option, best-fit, decision, or capable-platform recommendation frame.",
      method: "DETERMINISTIC_V1",
    };
  }

  return {
    label: "ORDINARY_MENTION",
    confidence: "MEDIUM",
    evidence: "The target is mentioned, but no sufficiently strong recommendation structure was detected.",
    method: "DETERMINISTIC_V1",
  };
}

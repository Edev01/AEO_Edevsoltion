/**
 * Conservative structured-brand discovery.
 *
 * The goal is NOT to perform open-ended NER. We only extract candidate names
 * from answer structures that commonly carry recommendations (tables, numbered
 * lists, bullets, headings). We then normalize markdown artifacts and reject
 * generic section labels before any candidate can become a measured competitor.
 */

const GENERIC_EXACT = new Set([
  "platform",
  "tool",
  "tools",
  "best for",
  "starting price",
  "standout feature",
  "beginner ease",
  "price",
  "pricing",
  "feature",
  "features",
  "key feature",
  "key features",
  "why it fits",
  "why it works",
  "pros",
  "cons",
  "summary",
  "overview",
  "recommendation",
  "recommendations",
  "other option",
  "other options",
  "alternatives",
  "honorable mentions",
  "honourable mentions",
  "small businesses",
  "general small businesses",
  "free plan",
  "paid plan",
  "recommendation summary",
  "recommendation overview",
  "pricing summary",
  "feature summary",
]);

const GENERIC_PREFIX =
  /^(best for|best overall|best all[- ]in[- ]one|best alternative|top pick|top choice|key features?|why (?:it )?fits?|why (?:it )?works?|pricing|starting price|standout feature|pros?|cons?|summary|overview)\b/i;

function unescapeMarkdown(value: string): string {
  return value.replace(/\\([^\p{L}\p{N}\s])/gu, "$1");
}

function stripListPrefix(value: string): string {
  return value
    .replace(/^\s*\d+\s*[.)]\s*/u, "")
    .replace(/^\s*[-*+]\s+/u, "")
    .trim();
}

function stripRenameParenthetical(value: string): string {
  const match = value.match(
    /^(.+?)\s*\(\s*(?:formerly|previously|formerly known as|previously known as|now|now known as)\s+[^)]+\)\s*[:.-]?\s*$/i,
  );

  return match?.[1]?.trim() || value;
}

function preferRightSideOfGenericLabel(value: string): string {
  const colon = value.indexOf(":");

  if (colon <= 0 || colon >= value.length - 1) {
    return value;
  }

  const left = value.slice(0, colon).trim();
  const right = value.slice(colon + 1).trim();

  if (GENERIC_PREFIX.test(left) && right) {
    return right;
  }

  return value;
}

function cleanCandidate(value: string): string {
  let cleaned = String(value ?? "")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`#]/g, "")
    .trim();

  cleaned = unescapeMarkdown(cleaned);
  cleaned = stripListPrefix(cleaned);
  cleaned = stripRenameParenthetical(cleaned);
  cleaned = preferRightSideOfGenericLabel(cleaned);

  cleaned = cleaned
    .replace(/\s+[-]\s+.*$/u, "")
    .replace(/[,:;.\s]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned;
}

function candidateKey(value: string): string {
  return cleanCandidate(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function looksLikeBrand(value: string): boolean {
  const cleaned = cleanCandidate(value);
  const normalizedWords = cleaned.toLowerCase().replace(/\s+/g, " ").trim();

  if (!cleaned || !candidateKey(cleaned)) return false;
  if (GENERIC_EXACT.has(normalizedWords)) return false;
  if (GENERIC_PREFIX.test(cleaned) && !cleaned.includes(":")) return false;

  if (cleaned.length < 2 || cleaned.length > 60) return false;

  const words = cleaned.split(/\s+/);
  if (words.length > 5) return false;

  if (/^(what|why|how|when|where|which|if|for|the|and|or|other)\b/i.test(cleaned)) {
    return false;
  }

  if (/[?!]$/.test(cleaned)) return false;

  return words.some(
    (word) =>
      /^[A-Z][A-Za-z0-9&.+-]*$/.test(word) ||
      /^[A-Z]{2,}$/.test(word),
  );
}

export function discoverStructuredBrandCandidates(
  response: string,
  targetBrand: string,
): string[] {
  const found = new Map<string, string>();
  const targetKey = candidateKey(targetBrand);

  const add = (raw: string) => {
    const candidate = cleanCandidate(raw);
    const key = candidateKey(candidate);

    if (
      !key ||
      key === targetKey ||
      (targetKey.length >= 4 && key.includes(targetKey)) ||
      !looksLikeBrand(candidate)
    ) {
      return;
    }

    if (!found.has(key)) {
      found.set(key, candidate);
    }
  };

  const lines = String(response ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim());

      const first = cells[0] ?? "";

      if (first && !/^[-: ]+$/.test(first)) {
        add(first);
      }
    }

    const patterns = [
      /^#{1,6}\s*(?:\d+\\?[.)]\s*)?(.+?)$/,
      /^\d+\\?[.)]\s+\*\*(.+?)\*\*(?:\s|$)/,
      /^[-*+]\s+\*\*(.+?)\*\*(?:\s|$)/,
      /^\*\*(.+?)\*\*(?:\s+[:-]|\s*$)/u,
      /^\d+\\?[.)]\s+(.+?)(?:\s+-\s+|$)/u,
    ];

    for (const pattern of patterns) {
      const match = line.match(pattern);
      if (match?.[1]) add(match[1]);
    }
  }

  return [...found.values()];
}



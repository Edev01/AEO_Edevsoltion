import { normalizeDomain } from "./normalize";
import type { BrandEntity } from "./types";

export type ConfiguredCompetitor = {
  name: string;
  aliases?: string[];
  websites?: string[];
};

export type AliasResolution = {
  canonicalName: string;
  alias: string;
  evidence: string;
};

export type PossibleAliasCollision = {
  left: string;
  right: string;
  reason: string;
};

export type DomainResolution = {
  canonicalName: string;
  domain: string;
  evidence: "CONFIGURED" | "NAME_DOMAIN_MATCH";
};

export type EntityResolutionResult = {
  competitors: BrandEntity[];
  mergedAliases: AliasResolution[];
  possibleAliasCollisions: PossibleAliasCollision[];
  inferredDomains: DomainResolution[];
};

function entityKey(value: string): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function escapedRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsExplicitAliasEvidence(
  canonicalName: string,
  candidateAlias: string,
  texts: string[],
): boolean {
  const canonical = escapedRegex(canonicalName);
  const alias = escapedRegex(candidateAlias);
  const patterns = [
    new RegExp(
      `\\b${canonical}\\b\\s*\\(\\s*(?:formerly|previously|formerly known as|previously known as)\\s+\\b${alias}\\b\\s*\\)`,
      "i",
    ),
    new RegExp(
      `\\b${alias}\\b\\s*\\(\\s*(?:now|rebranded as|now known as)\\s+\\b${canonical}\\b\\s*\\)`,
      "i",
    ),
    new RegExp(
      `\\b${canonical}\\b\\s*,?\\s*(?:formerly|previously|formerly known as|previously known as)\\s+\\b${alias}\\b`,
      "i",
    ),
    new RegExp(
      `\\b${alias}\\b\\s+(?:is now|became|rebranded as|is now known as)\\s+\\b${canonical}\\b`,
      "i",
    ),
  ];

  return texts.some((text) => patterns.some((pattern) => pattern.test(text)));
}

function apexLabel(value: string): string {
  const domain = normalizeDomain(value);
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";

  const last = parts[parts.length - 1] ?? "";
  const second = parts[parts.length - 2] ?? "";
  const commonSecondLevel = new Set(["co", "com", "net", "org", "gov", "edu", "ac"]);

  if (last.length === 2 && commonSecondLevel.has(second) && parts.length >= 3) {
    return parts[parts.length - 3] ?? "";
  }

  return second;
}

function namesFor(entity: BrandEntity): string[] {
  return [entity.canonicalName, ...entity.aliases];
}

export function resolveCompetitorEntities(input: {
  configured: ConfiguredCompetitor[];
  discovered: string[];
  evidenceTexts: string[];
  observedCitationDomains: string[];
}): EntityResolutionResult {
  const entities: BrandEntity[] = input.configured
    .filter((competitor) => Boolean(String(competitor.name ?? "").trim()))
    .map((competitor) => ({
      canonicalName: competitor.name.trim(),
      aliases: Array.isArray(competitor.aliases)
        ? competitor.aliases.map((alias) => String(alias ?? "").trim()).filter(Boolean)
        : [],
      domain: Array.isArray(competitor.websites)
        ? competitor.websites.map((website) => normalizeDomain(website)).find(Boolean)
        : undefined,
      isTarget: false,
    }));

  const mergedAliases: AliasResolution[] = [];
  const possibleAliasCollisions: PossibleAliasCollision[] = [];
  const aliasOwner = new Map<string, BrandEntity>();

  const rebuildAliasOwner = () => {
    aliasOwner.clear();
    for (const entity of entities) {
      for (const name of namesFor(entity)) {
        const key = entityKey(name);
        if (key) aliasOwner.set(key, entity);
      }
    }
  };

  rebuildAliasOwner();

  for (const rawCandidate of input.discovered) {
    const candidate = String(rawCandidate ?? "").trim();
    const candidateKey = entityKey(candidate);
    if (!candidate || !candidateKey || aliasOwner.has(candidateKey)) continue;

    const redundantCanonicalVariant =
      entities.find((entity) => {
        const canonicalKey = entityKey(entity.canonicalName);

        return (
          canonicalKey.length >= 4 &&
          candidateKey !== canonicalKey &&
          candidateKey.includes(canonicalKey)
        );
      });

    if (redundantCanonicalVariant) {
      continue;
    }

    const explicitOwner = entities.find(
      (entity) =>
        containsExplicitAliasEvidence(
          entity.canonicalName,
          candidate,
          input.evidenceTexts,
        ) ||
        entity.aliases.some((alias) =>
          containsExplicitAliasEvidence(alias, candidate, input.evidenceTexts),
        ),
    );

    if (explicitOwner) {
      explicitOwner.aliases.push(candidate);
      mergedAliases.push({
        canonicalName: explicitOwner.canonicalName,
        alias: candidate,
        evidence: "Explicit rename/rebrand wording observed in captured AI answer text.",
      });
      rebuildAliasOwner();
      continue;
    }

    entities.push({
      canonicalName: candidate,
      aliases: [],
      isTarget: false,
    });
    rebuildAliasOwner();
  }

  for (let i = 0; i < entities.length; i += 1) {
    for (let j = i + 1; j < entities.length; j += 1) {
      const left = entities[i];
      const right = entities[j];
      if (!left || !right) continue;

      const a = entityKey(left.canonicalName);
      const b = entityKey(right.canonicalName);
      if (!a || !b || a === b) continue;

      const shorter = a.length <= b.length ? a : b;
      const longer = a.length > b.length ? a : b;

      if (shorter.length >= 3 && longer.includes(shorter)) {
        possibleAliasCollisions.push({
          left: left.canonicalName,
          right: right.canonicalName,
          reason:
            "Names overlap, but Seroq found no explicit rename/alias evidence, so they were not merged automatically.",
        });
      }
    }
  }

  const observedDomains = [
    ...new Set(
      input.observedCitationDomains
        .map((domain) => normalizeDomain(domain))
        .filter(Boolean),
    ),
  ];

  const inferredDomains: DomainResolution[] = [];

  for (const entity of entities) {
    if (entity.domain) {
      inferredDomains.push({
        canonicalName: entity.canonicalName,
        domain: entity.domain,
        evidence: "CONFIGURED",
      });
      continue;
    }

    const nameKeys = new Set(namesFor(entity).map(entityKey).filter(Boolean));
    const matchingDomain = observedDomains.find((domain) =>
      nameKeys.has(entityKey(apexLabel(domain))),
    );

    if (matchingDomain) {
      entity.domain = matchingDomain;
      inferredDomains.push({
        canonicalName: entity.canonicalName,
        domain: matchingDomain,
        evidence: "NAME_DOMAIN_MATCH",
      });
    }
  }

  return {
    competitors: entities,
    mergedAliases,
    possibleAliasCollisions,
    inferredDomains,
  };
}



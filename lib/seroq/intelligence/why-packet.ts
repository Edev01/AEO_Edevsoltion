/**
 * Seroq Recommendation Intelligence - Structured WHY Packet
 * Connects observed competitor wins to verified evidence, inferred gaps,
 * addressability, and actionable interventions.
 */

export type EvidenceClass = 'VERIFIED' | 'OBSERVED' | 'INFERRED' | 'UNKNOWN';
export type AddressabilityLevel = 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
export type ActionPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface EvidenceItem {
  class: EvidenceClass;
  description: string;
  sourceUrls?: string[];
  schemaTypes?: string[];
}

export interface WhyPacket {
  id: string;
  journeyId: string;
  queryText: string;
  targetBrand: string;
  winningCompetitor: string;
  
  // 1. Observed AI Outcome
  observedOutcome: {
    competitorAppearedCount: number;
    totalValidTrials: number;
    frequencyRate: number;
  };

  // 2. Evidence Layers
  verifiedCompetitorEvidence: EvidenceItem[];
  verifiedCustomerEvidence: EvidenceItem[];

  // 3. Interpretation and Gap Analysis
  inferredGap: string;
  addressability: AddressabilityLevel;

  // 4. Proposed Intervention for Action Center
  proposedIntervention: {
    title: string;
    rationale: string;
    priority: ActionPriority;
    evidenceRefs: string[];
  };

  createdAt: string;
}

/**
 * Generates a structured WHY packet comparing the target brand against a recurring winner.
 */
export function generateWhyPacket({
  journeyId,
  queryText,
  targetBrand,
  winningCompetitor,
  competitorAppearedCount,
  totalValidTrials,
  competitorEvidence,
  customerEvidence,
  inferredGap,
  addressability,
  interventionTitle,
  interventionRationale,
  priority = 'P1',
}: {
  journeyId: string;
  queryText: string;
  targetBrand: string;
  winningCompetitor: string;
  competitorAppearedCount: number;
  totalValidTrials: number;
  competitorEvidence: EvidenceItem[];
  customerEvidence: EvidenceItem[];
  inferredGap: string;
  addressability: AddressabilityLevel;
  interventionTitle: string;
  interventionRationale: string;
  priority?: ActionPriority;
}): WhyPacket {
  const frequencyRate = totalValidTrials > 0 ? competitorAppearedCount / totalValidTrials : 0;

  return {
    id: `why-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    journeyId,
    queryText,
    targetBrand,
    winningCompetitor,
    observedOutcome: {
      competitorAppearedCount,
      totalValidTrials,
      frequencyRate,
    },
    verifiedCompetitorEvidence: competitorEvidence,
    verifiedCustomerEvidence: customerEvidence,
    inferredGap,
    addressability,
    proposedIntervention: {
      title: interventionTitle,
      rationale: interventionRationale,
      priority,
      evidenceRefs: competitorEvidence.map((e) => e.description),
    },
    createdAt: new Date().toISOString(),
  };
}

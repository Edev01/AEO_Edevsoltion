import { WhyPacket } from "./why-packet";
import type { SeroqActionItem } from "@/components/dashboard/types";

/**
 * Transforms a Structured WHY Packet into a native Seroq Action Center candidate.
 * Bridges Layer B (Intelligence) with Layer C (Execution).
 */
export function createActionFromWhyPacket(packet: WhyPacket): SeroqActionItem {
  return {
    id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    sourceKey: `journey-loss:${packet.journeyId}`,
    title: packet.proposedIntervention.title,
    rationale: packet.proposedIntervention.rationale,
    journey: packet.queryText,
    competitor: packet.winningCompetitor,
    evidenceClass: "INFERRED",
    evidenceRefs: [
      ...packet.proposedIntervention.evidenceRefs,
      ...packet.verifiedCompetitorEvidence.map((e) => e.description),
      ...packet.verifiedCustomerEvidence.map((e) => e.description),
    ],
    addressability: packet.addressability,
    priority: packet.proposedIntervention.priority,
    status: "new",
    notes: "",
    baselineRunIds: [],
    remeasurementRunIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

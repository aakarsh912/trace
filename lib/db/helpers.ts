import { db } from "./client";
import { actionNumberSequences } from "./schema";
import { sql } from "drizzle-orm";
import type { IfcCategory, ActionStatus, DeliverableStatus } from "./schema";

export const IFC_CATEGORIES: Record<IfcCategory, string> = {
  regulatory: "Regulatory Compliance",
  ps1: "PS1 · Assessment & Management of E&S Risks",
  ps2: "PS2 · Labor & Working Conditions",
  ps3: "PS3 · Resource Efficiency & Pollution Prevention",
  ps4: "PS4 · Community Health, Safety & Security",
  ps6: "PS6 · Biodiversity Conservation",
  ps8: "PS8 · Cultural Heritage",
  c1: "C1 · Community Engagement",
};

export function computeActionStatus(
  deliverables: { status: DeliverableStatus }[],
  isPublished: boolean
): ActionStatus {
  if (!isPublished) return "draft";
  if (deliverables.every((d) => d.status === "approved")) return "completed";
  if (deliverables.some((d) => d.status === "sent_back"))
    return "requires_attention";
  return "in_progress";
}

export async function getNextActionNumber(
  projectId: string,
  category: IfcCategory
): Promise<string> {
  const result = await db
    .insert(actionNumberSequences)
    .values({ projectId, ifcCategory: category, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [
        actionNumberSequences.projectId,
        actionNumberSequences.ifcCategory,
      ],
      set: {
        lastNumber: sql`${actionNumberSequences.lastNumber} + 1`,
      },
    })
    .returning();

  const prefix = category.toUpperCase().replace("REGULATORY", "RC");
  return `${prefix}-${result[0]!.lastNumber}`;
}

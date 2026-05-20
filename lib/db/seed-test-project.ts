import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql, eq } from "drizzle-orm";
import {
  workspaces,
  projects,
  actions,
  actionNumberSequences,
  deliverables,
} from "./schema";
import type { IfcCategory } from "./schema";

const db = drizzle(neon(process.env.DATABASE_URL!));

const PROJECT_ID = "534cc276-f98b-4fb6-9528-affaa3f2d7d4";

async function nextActionNumber(
  projectId: string,
  category: IfcCategory
): Promise<string> {
  const [result] = await db
    .insert(actionNumberSequences)
    .values({ projectId, ifcCategory: category, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [actionNumberSequences.projectId, actionNumberSequences.ifcCategory],
      set: { lastNumber: sql`${actionNumberSequences.lastNumber} + 1` },
    })
    .returning();
  const prefix = category.toUpperCase().replace("REGULATORY", "RC");
  return `${prefix}-${result!.lastNumber}`;
}

async function insertAction(opts: {
  category: IfcCategory;
  title: string;
  description: string;
  departmentHint: string;
  estimatedCost: string;
  deliverableDescriptions: string[];
}): Promise<void> {
  const actionNumber = await nextActionNumber(PROJECT_ID, opts.category);

  const [action] = await db
    .insert(actions)
    .values({
      projectId: PROJECT_ID,
      actionNumber,
      ifcCategory: opts.category,
      title: opts.title,
      description: opts.description,
      departmentHint: opts.departmentHint,
      estimatedCost: opts.estimatedCost,
      isPublished: false,
    })
    .returning();

  if (!action) throw new Error(`Failed to insert action: ${opts.title}`);

  const letters = "abcdefghijklmnopqrstuvwxyz";
  for (let i = 0; i < opts.deliverableDescriptions.length; i++) {
    await db.insert(deliverables).values({
      actionId: action.id,
      letter: letters[i]!,
      description: opts.deliverableDescriptions[i]!,
    });
  }

  console.log(`  ✓ ${actionNumber} — ${opts.title}`);
}

async function run(): Promise<void> {
  // Verify project exists
  const [project] = await db
    .select({ id: projects.id, name: projects.name, consultantWorkspaceId: projects.consultantWorkspaceId })
    .from(projects)
    .where(eq(projects.id, PROJECT_ID))
    .limit(1);

  if (!project) {
    console.error(`Project ${PROJECT_ID} not found.`);
    process.exit(1);
  }

  const [consultantWs] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, project.consultantWorkspaceId))
    .limit(1);

  console.log(`\nSeeding actions for: ${project.name}`);
  console.log(`Consultant workspace: ${consultantWs?.name ?? project.consultantWorkspaceId}\n`);

  // ── Regulatory Compliance ─────────────────────────────────────────────────

  console.log("Regulatory Compliance:");
  await insertAction({
    category: "regulatory",
    title: "Permit Required during planning and pre-construction phase",
    description:
      "The proposed project is currently in the planning stage. Following permits are required: a) Environment Clearance (under-process) b) Consent-to-Establish c) RERA d) License under Inter-state migrant worker Act 1979 e) Contract Labour Licence f) Fire NOC g) PSARA License h) BOCW Registration i) Updated/new requirements under new labour codes",
    departmentHint: "Corporate EHS and legal team",
    estimatedCost: "Cost associated with regulatory applications",
    deliverableDescriptions: [
      "EC",
      "CTE",
      "RERA Certificate",
      "Inter state migrant License",
      "Contract License",
      "PSARA License",
      "BOCW Registration",
      "Requirements under new labour codes",
    ],
  });

  // ── PS1 ───────────────────────────────────────────────────────────────────

  console.log("\nPS1 · Assessment and Management of E&S Risks:");
  await insertAction({
    category: "ps1",
    title: "Update of IMS",
    description:
      "Integrated Management System document shall be updated to include: SOP for CTE compliance, SOP for EC Compliance, SOP for C&D waste management, SOP for noise control, SOP for dust/fugitive emissions control",
    departmentHint: "Corporate EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated IMS document"],
  });

  await insertAction({
    category: "ps1",
    title: "E&S Policies",
    description:
      "a) Tender documents and work orders issued by Eldeco shall include E&S policy. b) Develop and incorporate GBVH policy in HR manual with quarterly training for all site level and contractor staff",
    departmentHint: "Corporate EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated tender document", "Updated HR manual"],
  });

  console.log("\nDone. 3 actions inserted as drafts.\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

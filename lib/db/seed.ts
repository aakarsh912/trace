import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  workspaces,
  users,
  workspaceMembers,
  projects,
  actions,
  actionNumberSequences,
  deliverables,
} from "./schema";
import type { IfcCategory, DeliverableStatus } from "./schema";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

async function seed(): Promise<void> {
  console.log("🌱 Seeding database...");

  // ─── Workspaces ─────────────────────────────────────────────────────────────
  console.log("Creating workspaces...");

  const [bankWs] = await db
    .insert(workspaces)
    .values({ name: "HDFC Capital", slug: "hdfc-capital", type: "bank" })
    .onConflictDoUpdate({ target: workspaces.slug, set: { name: "HDFC Capital" } })
    .returning();

  const [consultantWs] = await db
    .insert(workspaces)
    .values({ name: "Ramboll Mumbai", slug: "ramboll-mumbai", type: "consultant" })
    .onConflictDoUpdate({ target: workspaces.slug, set: { name: "Ramboll Mumbai" } })
    .returning();

  const [loaneeWs] = await db
    .insert(workspaces)
    .values({ name: "Eldeco Group", slug: "eldeco-group", type: "loanee" })
    .onConflictDoUpdate({ target: workspaces.slug, set: { name: "Eldeco Group" } })
    .returning();

  // ─── Users ───────────────────────────────────────────────────────────────────
  console.log("Creating users...");

  const userData = [
    { clerkUserId: "seed_arjun", email: "arjun@hdfccapital.com", firstName: "Arjun", lastName: "Krishnan" },
    { clerkUserId: "seed_kavya", email: "kavya@hdfccapital.com", firstName: "Kavya", lastName: "Nair" },
    { clerkUserId: "seed_priya", email: "priya@ramboll.com", firstName: "Priya", lastName: "Kapoor" },
    { clerkUserId: "seed_naveen", email: "naveen@ramboll.com", firstName: "Naveen", lastName: "Rao" },
    { clerkUserId: "seed_meera", email: "meera@eldeco.com", firstName: "Meera", lastName: "Sharma" },
    { clerkUserId: "seed_rahul", email: "rahul@eldeco.com", firstName: "Rahul", lastName: "Verma" },
  ];

  const createdUsers = await db
    .insert(users)
    .values(userData)
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email: sql`excluded.email` as SQL<string>,
        firstName: sql`excluded.first_name` as SQL<string | null>,
        lastName: sql`excluded.last_name` as SQL<string | null>,
      },
    })
    .returning();

  const userMap = Object.fromEntries(
    createdUsers.map((u) => [u.clerkUserId, u])
  ) as Record<string, typeof createdUsers[number]>;

  // ─── Workspace Members ───────────────────────────────────────────────────────
  console.log("Adding workspace members...");

  const memberData = [
    { workspaceId: bankWs!.id, userId: userMap["seed_arjun"]!.id, role: "admin" as const },
    { workspaceId: bankWs!.id, userId: userMap["seed_kavya"]!.id, role: "member" as const },
    { workspaceId: consultantWs!.id, userId: userMap["seed_priya"]!.id, role: "admin" as const },
    { workspaceId: consultantWs!.id, userId: userMap["seed_naveen"]!.id, role: "member" as const },
    { workspaceId: loaneeWs!.id, userId: userMap["seed_meera"]!.id, role: "admin" as const },
    { workspaceId: loaneeWs!.id, userId: userMap["seed_rahul"]!.id, role: "member" as const },
  ];

  await db
    .insert(workspaceMembers)
    .values(memberData)
    .onConflictDoNothing();

  // ─── Project Yamuna ──────────────────────────────────────────────────────────
  console.log("Creating Project Yamuna...");

  const [project] = await db
    .insert(projects)
    .values({
      name: "Project Yamuna",
      bankWorkspaceId: bankWs!.id,
      consultantWorkspaceId: consultantWs!.id,
      loaneeWorkspaceId: loaneeWs!.id,
      isPublished: true,
      publishedAt: new Date(),
      createdById: userMap["seed_priya"]!.id,
    })
    .onConflictDoNothing()
    .returning();

  if (!project) {
    console.log("Project already exists, skipping actions.");
    console.log("✅ Seed complete.");
    return;
  }

  // ─── Action Number Sequences ─────────────────────────────────────────────────
  const categories: IfcCategory[] = ["regulatory", "ps1", "ps2", "ps3", "ps4", "ps6", "ps8", "c1"];

  const seqData = categories.map((cat) => ({
    projectId: project.id,
    ifcCategory: cat,
    lastNumber: 0,
  }));

  await db.insert(actionNumberSequences).values(seqData).onConflictDoNothing();

  // ─── 22 Actions ──────────────────────────────────────────────────────────────
  console.log("Creating 22 actions...");

  type ActionSeed = {
    actionNumber: string;
    ifcCategory: IfcCategory;
    title: string;
    description: string;
    isPublished: boolean;
    deliverables: { letter: string; description: string; status: DeliverableStatus }[];
  };

  const actionSeeds: ActionSeed[] = [
    {
      actionNumber: "RC-1",
      ifcCategory: "regulatory",
      title: "Environmental Clearance Renewal",
      description: "Renew environmental clearance certificate before expiry as per MoEFCC requirements.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Submit renewal application to MoEFCC", status: "approved" },
        { letter: "B", description: "Obtain renewed EC certificate", status: "approved" },
      ],
    },
    {
      actionNumber: "RC-2",
      ifcCategory: "regulatory",
      title: "Consent to Operate Compliance",
      description: "Maintain valid Consent to Operate from State Pollution Control Board.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Upload current CTO certificate", status: "approved" },
        { letter: "B", description: "Provide SPCB inspection report", status: "submitted" },
      ],
    },
    {
      actionNumber: "PS1-1",
      ifcCategory: "ps1",
      title: "ESMS Documentation",
      description: "Establish and maintain an Environmental and Social Management System.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Prepare ESMS policy document signed by CEO", status: "approved" },
        { letter: "B", description: "Define roles and responsibilities matrix", status: "approved" },
        { letter: "C", description: "Submit annual ESMS review report", status: "sent_back" },
      ],
    },
    {
      actionNumber: "PS1-2",
      ifcCategory: "ps1",
      title: "E&S Risk Assessment",
      description: "Conduct comprehensive risk assessment covering all project phases.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Risk register with likelihood and impact ratings", status: "approved" },
        { letter: "B", description: "Mitigation plan for high-priority risks", status: "submitted" },
      ],
    },
    {
      actionNumber: "PS1-3",
      ifcCategory: "ps1",
      title: "Stakeholder Engagement Plan",
      description: "Develop and implement a stakeholder engagement plan.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Stakeholder mapping and analysis", status: "approved" },
        { letter: "B", description: "Engagement schedule and methodology", status: "pending" },
      ],
    },
    {
      actionNumber: "PS2-1",
      ifcCategory: "ps2",
      title: "Labour Policy",
      description: "Establish a written labour and working conditions policy.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "HR policy document aligned to IFC PS2", status: "approved" },
        { letter: "B", description: "Evidence of policy communication to workers", status: "approved" },
      ],
    },
    {
      actionNumber: "PS2-2",
      ifcCategory: "ps2",
      title: "Contractor Management",
      description: "Ensure contractors comply with PS2 labour requirements.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Contractor labour compliance clause in all contracts", status: "submitted" },
        { letter: "B", description: "Contractor audit report (last 12 months)", status: "pending" },
      ],
    },
    {
      actionNumber: "PS2-3",
      ifcCategory: "ps2",
      title: "Grievance Mechanism",
      description: "Implement a worker grievance mechanism with non-retaliation protections.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Grievance procedure document", status: "approved" },
        { letter: "B", description: "Grievance register for last 12 months", status: "sent_back" },
        { letter: "C", description: "Evidence of grievance resolution", status: "pending" },
      ],
    },
    {
      actionNumber: "PS3-1",
      ifcCategory: "ps3",
      title: "Waste Management Plan",
      description: "Implement a waste management and minimisation plan.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Waste management plan document", status: "approved" },
        { letter: "B", description: "Quarterly waste generation data", status: "submitted" },
      ],
    },
    {
      actionNumber: "PS3-2",
      ifcCategory: "ps3",
      title: "Wastewater Treatment",
      description: "Ensure wastewater is treated to regulatory standards before discharge.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "ETP performance data (monthly)", status: "pending" },
        { letter: "B", description: "Third-party effluent quality test report", status: "pending" },
      ],
    },
    {
      actionNumber: "PS3-3",
      ifcCategory: "ps3",
      title: "GHG Emissions Reporting",
      description: "Quantify and report Scope 1 and Scope 2 GHG emissions annually.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "GHG inventory report (Scope 1 & 2)", status: "submitted" },
        { letter: "B", description: "Emission reduction target with baseline", status: "pending" },
      ],
    },
    {
      actionNumber: "PS4-1",
      ifcCategory: "ps4",
      title: "Community Health & Safety Assessment",
      description: "Identify and manage project-related risks to community health and safety.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Community H&S risk assessment", status: "approved" },
        { letter: "B", description: "Emergency response plan", status: "approved" },
      ],
    },
    {
      actionNumber: "PS4-2",
      ifcCategory: "ps4",
      title: "Security Personnel Conduct",
      description: "Ensure security personnel are trained to the Voluntary Principles on Security and Human Rights.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Security provider contracts with VPSHR clauses", status: "submitted" },
        { letter: "B", description: "Training records for security personnel", status: "pending" },
      ],
    },
    {
      actionNumber: "PS6-1",
      ifcCategory: "ps6",
      title: "Biodiversity Baseline Survey",
      description: "Conduct a biodiversity baseline survey of the project area.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Flora and fauna baseline survey report", status: "approved" },
        { letter: "B", description: "Identification of critical habitat areas", status: "approved" },
      ],
    },
    {
      actionNumber: "PS6-2",
      ifcCategory: "ps6",
      title: "Biodiversity Management Plan",
      description: "Implement a Biodiversity Management Plan to avoid and minimise impacts.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Biodiversity Management Plan", status: "submitted" },
        { letter: "B", description: "Annual biodiversity monitoring report", status: "pending" },
      ],
    },
    {
      actionNumber: "PS8-1",
      ifcCategory: "ps8",
      title: "Cultural Heritage Screening",
      description: "Screen project area for known or potential cultural heritage resources.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Archaeological screening report", status: "approved" },
        { letter: "B", description: "Chance finds procedure", status: "approved" },
      ],
    },
    {
      actionNumber: "PS8-2",
      ifcCategory: "ps8",
      title: "Chance Find Protocol",
      description: "Implement and train workers on the chance finds protocol.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Signed acknowledgement from site supervisors", status: "submitted" },
      ],
    },
    {
      actionNumber: "C1-1",
      ifcCategory: "c1",
      title: "Community Consultation Process",
      description: "Conduct meaningful consultation with affected communities prior to key project decisions.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Consultation meeting minutes (at least 2 rounds)", status: "approved" },
        { letter: "B", description: "Attendance registers and sign-in sheets", status: "approved" },
        { letter: "C", description: "Summary of issues raised and responses", status: "sent_back" },
      ],
    },
    {
      actionNumber: "C1-2",
      ifcCategory: "c1",
      title: "Community Grievance Mechanism",
      description: "Establish an accessible grievance mechanism for affected communities.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Community grievance procedure (local language)", status: "submitted" },
        { letter: "B", description: "Grievance register for current period", status: "pending" },
      ],
    },
    {
      actionNumber: "C1-3",
      ifcCategory: "c1",
      title: "Community Investment Programme",
      description: "Implement community investment activities aligned to identified needs.",
      isPublished: true,
      deliverables: [
        { letter: "A", description: "Community needs assessment report", status: "approved" },
        { letter: "B", description: "Community investment plan and budget", status: "pending" },
      ],
    },
    {
      actionNumber: "PS1-4",
      ifcCategory: "ps1",
      title: "Monitoring & Reporting Framework",
      description: "Establish a monitoring and reporting framework for E&S performance.",
      isPublished: false,
      deliverables: [
        { letter: "A", description: "KPI framework document", status: "pending" },
        { letter: "B", description: "Semi-annual E&S performance report template", status: "pending" },
      ],
    },
    {
      actionNumber: "PS2-4",
      ifcCategory: "ps2",
      title: "Occupational Health & Safety",
      description: "Implement OHS management system aligned to ISO 45001.",
      isPublished: false,
      deliverables: [
        { letter: "A", description: "OHS policy and procedures manual", status: "pending" },
        { letter: "B", description: "Incident register (last 12 months)", status: "pending" },
        { letter: "C", description: "OHS training completion records", status: "pending" },
      ],
    },
  ];

  for (const actionSeed of actionSeeds) {
    const [action] = await db
      .insert(actions)
      .values({
        projectId: project.id,
        actionNumber: actionSeed.actionNumber,
        ifcCategory: actionSeed.ifcCategory,
        title: actionSeed.title,
        description: actionSeed.description,
        isPublished: actionSeed.isPublished,
        createdById: userMap["seed_priya"]!.id,
      })
      .returning();

    if (!action) continue;

    await db.insert(deliverables).values(
      actionSeed.deliverables.map((d) => ({
        actionId: action.id,
        letter: d.letter,
        description: d.description,
        status: d.status,
        assignedToId:
          d.status !== "pending"
            ? userMap["seed_rahul"]!.id
            : undefined,
      }))
    );
  }

  // Update sequences to match seeded numbers
  const sequenceUpdates: { category: IfcCategory; count: number }[] = [
    { category: "regulatory", count: 2 },
    { category: "ps1", count: 4 },
    { category: "ps2", count: 4 },
    { category: "ps3", count: 3 },
    { category: "ps4", count: 2 },
    { category: "ps6", count: 2 },
    { category: "ps8", count: 2 },
    { category: "c1", count: 3 },
  ];

  for (const { category, count } of sequenceUpdates) {
    await db
      .insert(actionNumberSequences)
      .values({ projectId: project.id, ifcCategory: category, lastNumber: count })
      .onConflictDoUpdate({
        target: [actionNumberSequences.projectId, actionNumberSequences.ifcCategory],
        set: { lastNumber: count },
      });
  }

  console.log("✅ Seed complete.");
  console.log("   Workspaces: HDFC Capital (bank), Ramboll Mumbai (consultant), Eldeco Group (loanee)");
  console.log("   Users: arjun, kavya, priya, naveen, meera, rahul");
  console.log("   Project: Project Yamuna — 22 actions, mixed statuses");
}

seed().catch((err: unknown) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

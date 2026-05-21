import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql, eq } from "drizzle-orm";
import {
  actions,
  actionNumberSequences,
  deliverables,
  projects,
  workspaces,
} from "./schema";
import type { IfcCategory } from "./schema";

const db = drizzle(neon(process.env.DATABASE_URL!));

const PROJECT_ID = "37e6ea35-8aef-4f1e-a74d-3f3b0c566e10";
const PRIYA_USER_ID = "020a31cc-3c1c-42df-a37a-fad8a1a6dd28";

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
      createdById: PRIYA_USER_ID,
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
  const [project] = await db
    .select({ id: projects.id, name: projects.name, consultantWorkspaceId: projects.consultantWorkspaceId })
    .from(projects)
    .where(eq(projects.id, PROJECT_ID))
    .limit(1);

  if (!project) { console.error("Project not found."); process.exit(1); }

  const [ws] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, project.consultantWorkspaceId))
    .limit(1);

  console.log(`\nSeeding: ${project.name} | Consultant: ${ws?.name}\n`);

  // ── Regulatory Compliance ──────────────────────────────────────────────────

  console.log("Regulatory Compliance:");
  await insertAction({
    category: "regulatory",
    title: "Permit Required during planning and pre-construction phase",
    description: "The proposed project is currently in the planning stage. Following permits are required to obtain and implement during the planning/pre-construction stage: a) Environment Clearance (under-process) b) Consent-to-Establish c) RERA d) License under Inter-state migrant worker Act 1979 e) Contract Labour Licence must be obtained by contractors during construction phase if they engage twenty or more workmen f) Fire NOC g) PSARA License to be obtained by security agency contracted for security services h) Obtain BOCW registration prior to commencement of construction activities i) Updated/new requirements under new labour codes",
    departmentHint: "Corporate EHS and legal team",
    estimatedCost: "Cost associated with regulatory applications for obtaining permits",
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

  console.log("\nPS1:");
  await insertAction({
    category: "ps1",
    title: "Update of IMS",
    description: "Integrated Management System document shall be updated to include: SOP for CTE compliance, SOP for EC Compliance, SOP for C&D waste management, SOP for noise control, SOP for dust/fugitive emissions control",
    departmentHint: "Corporate EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated IMS document"],
  });

  await insertAction({
    category: "ps1",
    title: "E&S Policies",
    description: "a) Tender documents and work orders issued by Eldeco shall include E&S policy as part of it. b) Develop and incorporate GBVH policy in HR manual along with quarterly training for all site level and contractor staff",
    departmentHint: "Corporate EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated tender document", "Updated HR manual"],
  });

  await insertAction({
    category: "ps1",
    title: "Identification of risks associated with site selection",
    description: "Develop a standard checklist for preliminary E&S screening of the potential sites. Preliminary E&S screening shall include location-specific risks, identification of nearby sensitivities, legacy pollution/contamination risks, social issues, etc.",
    departmentHint: "Corporate EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Site selection checklist"],
  });

  await insertAction({
    category: "ps1",
    title: "Organization capacity and competency",
    description: "Appoint a dedicated officer at corporate level to support implementation of the IMS, co-ordinate social and environmental management activities, and ensure consistent monitoring of site-level E&S risks and commitments. Site-specific organization team shall include a designated community liaisoning and grievance redressal officer. Site-specific organization chart shall be updated to include pictures and contact numbers of team members and displayed across multiple locations at the site.",
    departmentHint: "Corporate management team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: [
      "Copy of appointment letter/job description including roles & responsibilities",
      "Updated site-specific organization chart",
    ],
  });

  await insertAction({
    category: "ps1",
    title: "Emergency Preparedness and Response Plan",
    description: "Update the site-specific EPRP to include a map indicating emergency evacuation route, assembly point, location of fire extinguishers, first-aid boxes and spill control kits, names and contact details of first respondent team, etc. for the site.",
    departmentHint: "Site-specific EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated EPRP"],
  });

  await insertAction({
    category: "ps1",
    title: "Coverage of legal register",
    description: "Update the existing legal register to: Identify and include all applicable environment, safety and social related permits along with applicable Indian regulations. Include a list of individual conditions prescribed via issued permits (such as EC, CTE, fire NOC, etc.) to check compliance status. Assign responsibility to a person from Eldeco team for compliance and renewal of obtained permits. Project will prepare a Permit Milestone Monitoring Plan for the main permits required during the planning/pre-construction stage.",
    departmentHint: "Corporate EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated legal register and Permit Milestone Monitoring Plan"],
  });

  await insertAction({
    category: "ps1",
    title: "Stakeholder Engagement Plan (SEP)",
    description: "Develop a separate site-level SEP that includes stakeholder identification and mapping (based on their impact and influence on site activities), stakeholder analysis, and a structured approach for stakeholder engagement activities along with associated disclosure requirements.",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["SEP"],
  });

  // ── PS2 ───────────────────────────────────────────────────────────────────

  console.log("\nPS2:");
  await insertAction({
    category: "ps2",
    title: "Human Resource Policy and Procedure",
    description: "Update the HR Manual by adding the following policies to align with IFC PS2: Prohibition of child labour, Prevention of forced or bonded labour, Freedom of association and collective bargaining, Retrenchment, Diversity and inclusion, Working hours and Overtime management, Workers Accommodation, Gender-Based Violence and Harassment",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated HR Manual"],
  });

  await insertAction({
    category: "ps2",
    title: "POSH",
    description: "Eldeco to adopt the following measures to comply with the POSH Act 2013: a) Disclosure of POSH Act Policy at the site level with all the workforce b) Arrange a recurring workshop for all the workforce on POSH policy and the compliant documentation process including employees and contractors c) Keep a compliant register to document all sexual harassment incidents, including concerns from female contractor workers d) Create an annual report summarizing incidents or concerns related to sexual harassment on site",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: [
      "MoM of POSH Act Policy with workforce",
      "Training Module on Posh Act 2013",
      "Sample complaint register",
      "Sample annual report",
    ],
  });

  await insertAction({
    category: "ps2",
    title: "Appointment Letter",
    description: "Ensure that all the workforce engaged at the site are provided with an appointment or joining letter, which shall include the rights related to hours of work, wages, overtime, compensation, and benefits offered to the workforce.",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Sample appointment letter"],
  });

  await insertAction({
    category: "ps2",
    title: "Working hours, Over Time, Attendance Record",
    description: "a) Eldeco shall ensure compliance with statutory working hour limits stipulated under the BOCW Act, 1996 and Rules 2005 b) Ensure compliance with BOCW Act 1996 by paying workers overtime at twice the normal wage rate c) Ensure that wages paid to security personnel are in line with the revised minimum wage notification dated March 2025 d) Increase the number of security personnel and restructure working hours into three shifts of eight hours each",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: [
      "Verification of attendance records, wage registers, overtime registers",
      "Updated wage slip of security personnel aligned with revised minimum wage notification",
      "Restructuring of working hours into three shifts for security guards",
    ],
  });

  await insertAction({
    category: "ps2",
    title: "Workers Organization",
    description: "Formulate a policy on workers freedom of association in their HR policy or develop alternative mechanisms to express their grievances and protect their rights",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated HR Manual"],
  });

  await insertAction({
    category: "ps2",
    title: "Child Labour and Forced Labour",
    description: "a) Revise and update the HR manual to incorporate policies on prohibiting child labour and forced or bonded labour, in line with Child and Adolescent Labour (Prohibition and Regulation) Act, 1986 and Bonded Labour System (Abolition) Act, 1976 b) Ensure that contracts and work orders with contractors include specific clauses prohibiting the use of bonded labour in accordance with the Bonded Labour System (Abolition) Act, 1976",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated HR Manual", "Updated work order"],
  });

  await insertAction({
    category: "ps2",
    title: "Non-Discrimination and Equal Opportunity",
    description: "Eldeco should revise its HR and recruitment policies to incorporate provisions on equal remuneration for work of equal value in accordance with the Equal Remuneration Act, 1976 and IFC PS2 requirements and same shall be applicable to its contractors",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Updated HR Manual"],
  });

  await insertAction({
    category: "ps2",
    title: "Retrenchment Policy",
    description: "Develop retrenchment policy and procedure and align it with requirements of Industrial Disputes Act 1947 and IFC PS. This should contain: Analysis of alternatives to retrenchment, If the analysis does not identify viable alternatives, a Retrenchment Plan will be developed. The retrenchment procedure will be based on the principle of non-discrimination and will reflect consultation with workers, prior information to workers, and applicable severance payments",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Documented Retrenchment Policy and Plan"],
  });

  await insertAction({
    category: "ps2",
    title: "Labour Accommodation",
    description: "Develop and implement a Worker/Labour Accommodation Plan according to the requirements of applicable laws such as BoCW Act, 1996 and rules and IFC/EBRD Guidelines on Worker Accommodation, 2008, as relevant to the project.",
    departmentHint: "Eldeco Management Team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: [
      "Worker/Labour accommodation plan and monitoring plan",
      "Date & Time stamped images of the labour accommodations",
    ],
  });

  await insertAction({
    category: "ps2",
    title: "Third Party Workers",
    description: "a) Eldeco shall develop a contractor management and monitoring mechanism for E&S risk identification and monitoring which could include audits, inspections of wage registers of its manpower agencies b) Amend work order with security agency and detail out statutory requirements on minimum wages, overtime premiums, daily/weekly hour limits and rest breaks, and statutory deductions c) The tender document should be revised to explicitly include the Child and Adolescent Labour Act, 1986, the Bonded Labour System Act, 1976 and Equal Remuneration Act, 1976",
    departmentHint: "Corporate HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: [
      "Contractual Management Plan",
      "Revised Security agency work order",
      "Updated tender document",
    ],
  });

  // ── PS3 ───────────────────────────────────────────────────────────────────

  console.log("\nPS3:");
  await insertAction({
    category: "ps3",
    title: "Greenhouse Gases",
    description: "Assess and quantify the GHG emissions across different stages of the project lifecycle.",
    departmentHint: "Corporate EHS team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: ["Date sheets with necessary records for emission calculation"],
  });

  await insertAction({
    category: "ps3",
    title: "Pollution Prevention and Waste Management",
    description: "a) Ensure that SOPs developed at corporate level for storage of raw materials are followed at under-construction sites b) Install mobile toilets at temporary worker accommodations to ensure hygienic conditions and prevent open defecation or wastewater discharge c) Provide labelled waste storage bins at the site for segregated waste storage",
    departmentHint: "Site-specific EHS team",
    estimatedCost: "Minor cost",
    deliverableDescriptions: [
      "Time and date stamped images - Raw materials storage",
      "Installation of mobile toilets",
      "Labelled waste storage bins",
    ],
  });

  // ── PS4 ───────────────────────────────────────────────────────────────────

  console.log("\nPS4:");
  await insertAction({
    category: "ps4",
    title: "Security Personnel",
    description: "a) Conduct training of security guards on human rights, stakeholder engagement, grievance redressal, etc. b) Ensure that contracted security agencies have obtained valid licenses under the Private Security Agencies (Regulation) Act, 2005 (PSARA)",
    departmentHint: "Site-specific HR team",
    estimatedCost: "Internal activity",
    deliverableDescriptions: [
      "Valid PSARA licenses of security agencies",
      "Training Module for security guards",
    ],
  });

  console.log("\n✓ Done — 21 actions inserted as drafts.\n");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import {
  projects,
  workspaces,
  actions,
  deliverables,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NewActionModal } from "@/components/actions/new-action-modal";
import { getAllWorkspacesForClerkUser, resolveActiveWorkspace } from "@/lib/auth/active-workspace";
import type { WorkspaceType, IfcCategory } from "@/lib/db/schema";
import { ProjectViewClient } from "@/components/projects/project-view-client";
import type { SerializedActionRow } from "@/components/projects/project-view-client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionRow = {
  id: string;
  actionNumber: string;
  ifcCategory: IfcCategory;
  title: string;
  description: string | null;
  isPublished: boolean;
  total: number;
  pending: number;
  submitted: number;
  approved: number;
  sentBack: number;
  targetDate: Date | null;
  departmentHint: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
};

type ProjectData = {
  id: string;
  name: string;
  isPublished: boolean;
  bankName: string;
  consultantName: string;
  loaneeName: string;
};

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getUserWorkspaceContext(): Promise<{
  workspaceId: string;
  workspaceType: WorkspaceType;
  role: string;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const allWorkspaces = await getAllWorkspacesForClerkUser(userId);
  const activeId = cookies().get("active_workspace")?.value;
  const active = resolveActiveWorkspace(allWorkspaces, activeId);
  if (!active) return null;

  return {
    workspaceId: active.id,
    workspaceType: active.type,
    role: active.role,
  };
}

async function getProjectData(
  projectId: string,
  workspaceId: string,
  workspaceType: WorkspaceType
): Promise<ProjectData | null> {
  const bankWs = alias(workspaces, "bank_ws");
  const consultantWs = alias(workspaces, "consultant_ws");
  const loaneeWs = alias(workspaces, "loanee_ws");

  const wsCondition =
    workspaceType === "bank"
      ? eq(projects.bankWorkspaceId, workspaceId)
      : workspaceType === "consultant"
      ? eq(projects.consultantWorkspaceId, workspaceId)
      : eq(projects.loaneeWorkspaceId, workspaceId);

  const rows = await db
    .select({
      id: projects.id,
      name: projects.name,
      isPublished: projects.isPublished,
      bankName: bankWs.name,
      consultantName: consultantWs.name,
      loaneeName: loaneeWs.name,
    })
    .from(projects)
    .innerJoin(bankWs, eq(projects.bankWorkspaceId, bankWs.id))
    .innerJoin(
      consultantWs,
      eq(projects.consultantWorkspaceId, consultantWs.id)
    )
    .innerJoin(loaneeWs, eq(projects.loaneeWorkspaceId, loaneeWs.id))
    .where(and(eq(projects.id, projectId), wsCondition, isNull(projects.deletedAt)))
    .limit(1);

  return rows[0] ?? null;
}

async function getActionsForProject(projectId: string): Promise<ActionRow[]> {
  const conditions = [
    eq(actions.projectId, projectId),
    isNull(actions.deletedAt),
    eq(actions.isPublished, true),
  ];

  const actionRows = await db
    .select({
      id: actions.id,
      actionNumber: actions.actionNumber,
      ifcCategory: actions.ifcCategory,
      title: actions.title,
      description: actions.description,
      isPublished: actions.isPublished,
      targetDate: actions.targetDate,
      departmentHint: actions.departmentHint,
      assigneeFirstName: users.firstName,
      assigneeLastName: users.lastName,
    })
    .from(actions)
    .leftJoin(users, eq(actions.assignedToId, users.id))
    .where(and(...conditions));

  if (actionRows.length === 0) return [];

  const actionIds = actionRows.map((a) => a.id);

  const statRows = await db
    .select({
      actionId: deliverables.actionId,
      status: deliverables.status,
      count: sql<number>`count(*)::int`,
    })
    .from(deliverables)
    .where(
      and(inArray(deliverables.actionId, actionIds), isNull(deliverables.deletedAt))
    )
    .groupBy(deliverables.actionId, deliverables.status);

  type Counts = {
    pending: number;
    submitted: number;
    approved: number;
    sentBack: number;
    total: number;
  };

  const statsMap = new Map<string, Counts>();

  for (const row of statRows) {
    if (!statsMap.has(row.actionId)) {
      statsMap.set(row.actionId, {
        pending: 0,
        submitted: 0,
        approved: 0,
        sentBack: 0,
        total: 0,
      });
    }
    const entry = statsMap.get(row.actionId)!;
    const count = Number(row.count);
    entry.total += count;
    if (row.status === "approved") entry.approved = count;
    else if (row.status === "submitted") entry.submitted = count;
    else if (row.status === "sent_back") entry.sentBack = count;
    else entry.pending += count;
  }

  return actionRows.map((a) => {
    const s = statsMap.get(a.id) ?? {
      pending: 0,
      submitted: 0,
      approved: 0,
      sentBack: 0,
      total: 0,
    };
    return {
      id: a.id,
      actionNumber: a.actionNumber,
      ifcCategory: a.ifcCategory,
      title: a.title,
      description: a.description,
      isPublished: a.isPublished,
      targetDate: a.targetDate ?? null,
      departmentHint: a.departmentHint ?? null,
      assigneeFirstName: a.assigneeFirstName ?? null,
      assigneeLastName: a.assigneeLastName ?? null,
      total: s.total,
      pending: s.pending,
      submitted: s.submitted,
      approved: s.approved,
      sentBack: s.sentBack,
    };
  });
}

// ─── Project Header (server component) ───────────────────────────────────────

function ProjectHeader({
  project,
  totalDeliverables,
  approvedDeliverables,
  submittedDeliverables,
  pendingDeliverables,
  sentBackDeliverables,
  workspaceType,
  role,
  projectId,
}: {
  project: ProjectData;
  totalDeliverables: number;
  approvedDeliverables: number;
  submittedDeliverables: number;
  pendingDeliverables: number;
  sentBackDeliverables: number;
  workspaceType: WorkspaceType;
  role: string;
  projectId: string;
}): JSX.Element {
  const isConsultantAdmin = workspaceType === "consultant" && role === "admin";
  const isConsultant = workspaceType === "consultant";
  const pct = (n: number): string =>
    totalDeliverables === 0
      ? "0%"
      : `${Math.round((n / totalDeliverables) * 100)}%`;

  return (
    <div style={{ padding: "20px 32px 0 32px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-0.015em",
            margin: 0,
          }}
        >
          {project.name}
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 7px",
              borderRadius: 4,
              background: "var(--ifc-bg)",
              color: "var(--ifc-fg)",
              fontSize: 11,
              fontWeight: 500,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            Category B
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: project.isPublished
                ? "var(--status-approved-fg)"
                : "var(--status-draft-fg)",
            }}
          >
            {project.isPublished ? "Active" : "Draft"}
          </span>
          {isConsultant && (
            <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
              {isConsultantAdmin && (
                <Link
                  href={`/projects/${projectId}/edit`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    background: "transparent",
                    fontSize: 12.5,
                    color: "var(--fg-secondary)",
                    textDecoration: "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M11 2l3 3-8 8H3v-3L11 2z" />
                  </svg>
                  Edit action plan
                </Link>
              )}
              <NewActionModal
                projectId={projectId}
                projectName={project.name}
                loaneeName={project.loaneeName}
              />
            </div>
          )}
        </div>
      </div>

      {/* Meta row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          fontSize: 12.5,
          color: "var(--fg-secondary)",
          flexWrap: "wrap",
          paddingBottom: 16,
        }}
      >
        <span>
          <span style={{ color: "var(--fg-tertiary)" }}>Loanee </span>
          <strong>{project.loaneeName}</strong>
        </span>
        <span>
          <span style={{ color: "var(--fg-tertiary)" }}>Consultant </span>
          <strong>{project.consultantName}</strong>
        </span>
        {workspaceType !== "bank" && (
          <span>
            <span style={{ color: "var(--fg-tertiary)" }}>Bank </span>
            <strong>{project.bankName}</strong>
          </span>
        )}
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ color: "var(--fg-tertiary)" }}>Progress</span>
          <span
            style={{
              width: 100,
              height: 5,
              background: "var(--bg-subtle)",
              borderRadius: 3,
              overflow: "hidden",
              display: "inline-flex",
            }}
          >
            {approvedDeliverables > 0 && (
              <span
                style={{
                  width: pct(approvedDeliverables),
                  background: "var(--status-approved-fg)",
                }}
              />
            )}
            {submittedDeliverables > 0 && (
              <span
                style={{
                  width: pct(submittedDeliverables),
                  background: "var(--status-submitted-fg)",
                }}
              />
            )}
            {pendingDeliverables > 0 && (
              <span
                style={{
                  width: pct(pendingDeliverables),
                  background: "var(--status-progress-fg)",
                }}
              />
            )}
            {sentBackDeliverables > 0 && (
              <span
                style={{
                  width: pct(sentBackDeliverables),
                  background: "var(--status-returned-fg)",
                }}
              />
            )}
          </span>
          <strong>
            {approvedDeliverables} / {totalDeliverables}
          </strong>
        </span>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: { projectId: string };
  searchParams: { view?: string };
}): Promise<JSX.Element> {
  const ctx = await getUserWorkspaceContext();
  if (!ctx) redirect("/login");

  const { workspaceId, workspaceType, role } = ctx;
  const view = searchParams.view === "board" ? "board" : "table";

  const [project, actionRows] = await Promise.all([
    getProjectData(params.projectId, workspaceId, workspaceType),
    getActionsForProject(params.projectId),
  ]);

  if (!project) notFound();

  const totalDeliverables = actionRows.reduce((s, a) => s + a.total, 0);
  const approvedDeliverables = actionRows.reduce((s, a) => s + a.approved, 0);
  const submittedDeliverables = actionRows.reduce((s, a) => s + a.submitted, 0);
  const pendingDeliverables = actionRows.reduce((s, a) => s + a.pending, 0);
  const sentBackDeliverables = actionRows.reduce((s, a) => s + a.sentBack, 0);

  // Serialize Dates for the client component
  const serializedRows: SerializedActionRow[] = actionRows.map((a) => ({
    ...a,
    targetDate: a.targetDate ? a.targetDate.toISOString() : null,
  }));

  return (
    <div style={{ margin: "-24px" }}>
      <ProjectHeader
        project={project}
        totalDeliverables={totalDeliverables}
        approvedDeliverables={approvedDeliverables}
        submittedDeliverables={submittedDeliverables}
        pendingDeliverables={pendingDeliverables}
        sentBackDeliverables={sentBackDeliverables}
        workspaceType={workspaceType}
        role={role}
        projectId={params.projectId}
      />
      <ProjectViewClient
        actionRows={serializedRows}
        projectId={params.projectId}
        view={view}
        isConsultant={workspaceType === "consultant"}
        projectName={project.name}
        loaneeName={project.loaneeName}
      />
    </div>
  );
}

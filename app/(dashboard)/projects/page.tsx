import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import {
  projects,
  workspaces,
  actions,
  deliverables,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { WorkspaceType } from "@/lib/db/schema";
import { getAllWorkspacesForClerkUser, resolveActiveWorkspace } from "@/lib/auth/active-workspace";
import { ProjectsClient } from "@/components/projects/projects-client";
import type { ProjectWithStats } from "@/components/projects/projects-client";

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

async function getProjectsForWorkspace(
  workspaceId: string,
  workspaceType: WorkspaceType
): Promise<ProjectWithStats[]> {
  const bankWs = alias(workspaces, "bank_ws");
  const consultantWs = alias(workspaces, "consultant_ws");
  const loaneeWs = alias(workspaces, "loanee_ws");

  const wsCondition =
    workspaceType === "bank"
      ? eq(projects.bankWorkspaceId, workspaceId)
      : workspaceType === "consultant"
      ? eq(projects.consultantWorkspaceId, workspaceId)
      : eq(projects.loaneeWorkspaceId, workspaceId);

  const projectRows = await db
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
    .innerJoin(consultantWs, eq(projects.consultantWorkspaceId, consultantWs.id))
    .innerJoin(loaneeWs, eq(projects.loaneeWorkspaceId, loaneeWs.id))
    .where(and(wsCondition, isNull(projects.deletedAt)));

  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => p.id);

  const statRows = await db
    .select({
      projectId: actions.projectId,
      status: deliverables.status,
      count: sql<number>`count(*)::int`,
    })
    .from(deliverables)
    .innerJoin(actions, eq(deliverables.actionId, actions.id))
    .where(
      and(
        inArray(actions.projectId, projectIds),
        isNull(deliverables.deletedAt),
        isNull(actions.deletedAt)
      )
    )
    .groupBy(actions.projectId, deliverables.status);

  type StatsEntry = {
    approved: number;
    submitted: number;
    pending: number;
    sentBack: number;
    total: number;
  };

  const statsMap = new Map<string, StatsEntry>();

  for (const row of statRows) {
    if (!statsMap.has(row.projectId)) {
      statsMap.set(row.projectId, {
        approved: 0,
        submitted: 0,
        pending: 0,
        sentBack: 0,
        total: 0,
      });
    }
    const entry = statsMap.get(row.projectId)!;
    const count = Number(row.count);
    entry.total += count;
    if (row.status === "approved") entry.approved = count;
    else if (row.status === "submitted") entry.submitted = count;
    else if (row.status === "sent_back") entry.sentBack = count;
    else entry.pending += count;
  }

  return projectRows.map((p) => {
    const s = statsMap.get(p.id) ?? {
      approved: 0,
      submitted: 0,
      pending: 0,
      sentBack: 0,
      total: 0,
    };
    return {
      id: p.id,
      name: p.name,
      isPublished: p.isPublished,
      bankName: p.bankName,
      consultantName: p.consultantName,
      loaneeName: p.loaneeName,
      totalDeliverables: s.total,
      approvedCount: s.approved,
      submittedCount: s.submitted,
      pendingCount: s.pending,
      sentBackCount: s.sentBack,
    };
  });
}

export default async function ProjectsPage(): Promise<JSX.Element> {
  const ctx = await getUserWorkspaceContext();
  if (!ctx) redirect("/login");

  const { workspaceId, workspaceType, role } = ctx;
  const allProjects = await getProjectsForWorkspace(workspaceId, workspaceType);

  const pageTitle =
    workspaceType === "bank"
      ? "All Projects"
      : workspaceType === "loanee"
      ? "Your projects"
      : "Projects";

  const pageSubtitle =
    workspaceType === "bank"
      ? "All active engagements across loanees and consultants."
      : workspaceType === "consultant"
      ? "Engagements you're leading as the consultant."
      : "Active engagements with your bank. Click in to view your action plan.";

  const isConsultantAdmin =
    workspaceType === "consultant" && role === "admin";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      {/* Page header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: "var(--fg)",
              margin: 0,
              letterSpacing: "-0.02em",
              marginBottom: 4,
            }}
          >
            {pageTitle}
          </h1>
          <p style={{ fontSize: 13, color: "var(--fg-tertiary)", margin: 0 }}>
            {pageSubtitle}
          </p>
        </div>

        {isConsultantAdmin && (
          <Link
            href="/projects/new"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "8px 14px",
              background: "var(--fg)",
              color: "white",
              borderRadius: "var(--radius)",
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 2v12M2 8h12" />
            </svg>
            New Project
          </Link>
        )}
      </div>

      <ProjectsClient projects={allProjects} workspaceType={workspaceType} />
    </div>
  );
}

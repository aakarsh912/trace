import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/lib/db/client";
import {
  projects,
  workspaces,
  users,
  workspaceMembers,
  actions,
  deliverables,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { WorkspaceType } from "@/lib/db/schema";
import { getAllWorkspacesForClerkUser, resolveActiveWorkspace } from "@/lib/auth/active-workspace";

type ProjectWithStats = {
  id: string;
  name: string;
  bankName: string;
  consultantName: string;
  loaneeName: string;
  totalDeliverables: number;
  approvedCount: number;
  submittedCount: number;
  pendingCount: number;
  sentBackCount: number;
};

function projectInitials(name: string): string {
  const cleaned = name.replace(/^Project\s+/i, "");
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

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

function MiniProgressBar({
  project,
}: {
  project: ProjectWithStats;
}): JSX.Element {
  const total = project.totalDeliverables;
  if (total === 0) {
    return (
      <div
        style={{
          width: 80,
          height: 4,
          background: "var(--border)",
          borderRadius: 2,
        }}
      />
    );
  }
  const pct = (n: number): string => `${Math.round((n / total) * 100)}%`;
  return (
    <div
      style={{
        width: 80,
        height: 4,
        background: "var(--border)",
        borderRadius: 2,
        overflow: "hidden",
        display: "flex",
      }}
    >
      {project.approvedCount > 0 && (
        <div
          style={{
            width: pct(project.approvedCount),
            background: "var(--status-approved-fg)",
            flexShrink: 0,
          }}
        />
      )}
      {project.submittedCount > 0 && (
        <div
          style={{
            width: pct(project.submittedCount),
            background: "var(--status-submitted-fg)",
            flexShrink: 0,
          }}
        />
      )}
      {project.pendingCount > 0 && (
        <div
          style={{
            width: pct(project.pendingCount),
            background: "var(--status-progress-fg)",
            flexShrink: 0,
          }}
        />
      )}
      {project.sentBackCount > 0 && (
        <div
          style={{
            width: pct(project.sentBackCount),
            background: "var(--status-returned-fg)",
            flexShrink: 0,
          }}
        />
      )}
    </div>
  );
}

function ProjectRow({
  project,
  workspaceType,
}: {
  project: ProjectWithStats;
  workspaceType: WorkspaceType;
}): JSX.Element {
  const needsAttention = project.sentBackCount > 0;
  const initials = projectInitials(project.name);

  const metaItems: Array<{ text: string; color?: string }> = [];
  if (workspaceType === "consultant") {
    metaItems.push({ text: project.loaneeName });
    metaItems.push({ text: project.bankName });
  } else if (workspaceType === "bank") {
    metaItems.push({ text: project.loaneeName });
    metaItems.push({ text: project.consultantName });
  } else {
    metaItems.push({ text: project.consultantName });
  }

  if (project.sentBackCount > 0) {
    metaItems.push({
      text: `${project.sentBackCount} returned`,
      color: "var(--status-returned-fg)",
    });
  } else if (project.submittedCount > 0 && workspaceType === "consultant") {
    metaItems.push({
      text: `${project.submittedCount} submitted`,
      color: "var(--status-submitted-fg)",
    });
  }

  return (
    <Link
      href={`/projects/${project.id}`}
      className={
        needsAttention
          ? "project-row-link project-row-attention"
          : "project-row-link"
      }
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: "var(--radius-lg)",
        border: needsAttention ? "1px solid #E8D0A8" : "1px solid var(--border)",
        textDecoration: "none",
        color: "inherit",
        transition: "background 80ms",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "var(--radius)",
          background: needsAttention ? "#F0E6CE" : "var(--bg-subtle)",
          color: needsAttention ? "#8F5A1E" : "var(--fg-secondary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          fontWeight: 600,
          flexShrink: 0,
          fontFamily: "monospace",
          letterSpacing: "-0.02em",
        }}
      >
        {initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--fg)",
            marginBottom: 3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {project.name}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            color: "var(--fg-tertiary)",
          }}
        >
          {metaItems.map((item, i) => (
            <Fragment key={i}>
              {i > 0 && (
                <span style={{ color: "var(--fg-disabled)" }}>·</span>
              )}
              <span style={item.color ? { color: item.color } : undefined}>
                {item.text}
              </span>
            </Fragment>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 6,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MiniProgressBar project={project} />
          <span
            style={{
              fontSize: 12,
              color: "var(--fg-tertiary)",
              whiteSpace: "nowrap",
              minWidth: 40,
              textAlign: "right",
            }}
          >
            {project.approvedCount} / {project.totalDeliverables}
          </span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "2px 7px",
            borderRadius: 4,
            background: "var(--ifc-bg)",
            color: "var(--ifc-fg)",
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: "0.01em",
          }}
        >
          Category B
        </span>
      </div>
    </Link>
  );
}

function FilterRow({
  workspaceType,
  count,
}: {
  workspaceType: WorkspaceType;
  count: number;
}): JSX.Element {
  const placeholder =
    workspaceType === "bank"
      ? "Search loanees, projects, consultants…"
      : "Search projects…";

  const countLabel =
    count === 1 ? "1 active project" : `${count} active projects`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 16,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "6px 10px",
          background: "var(--bg-surface)",
          minWidth: 220,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}
        >
          <circle cx="7" cy="7" r="4" />
          <path d="M10 10l3 3" />
        </svg>
        <input
          placeholder={placeholder}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: 13,
            color: "var(--fg)",
            fontFamily: "inherit",
            width: "100%",
          }}
        />
      </div>

      {workspaceType !== "loanee" && (
        <button className="filter-chip-btn">
          All loanees
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      )}

      {workspaceType === "bank" && (
        <button className="filter-chip-btn">
          All consultants
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M4 6l4 4 4-4" />
          </svg>
        </button>
      )}

      <button className="filter-chip-btn">
        Status: Active
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      <span
        style={{
          marginLeft: "auto",
          fontSize: 12,
          color: "var(--fg-tertiary)",
        }}
      >
        {countLabel}
      </span>
    </div>
  );
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

      {/* Filter row */}
      <FilterRow workspaceType={workspaceType} count={allProjects.length} />

      {/* Project list */}
      {allProjects.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "64px 24px",
            color: "var(--fg-tertiary)",
            gap: 8,
            textAlign: "center",
          }}
        >
          <svg
            width="32"
            height="32"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            style={{ opacity: 0.4 }}
          >
            <path d="M2 4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" />
          </svg>
          <p style={{ fontSize: 13, margin: 0, fontWeight: 500, color: "var(--fg-secondary)" }}>
            No projects yet
          </p>
          <p style={{ fontSize: 12, margin: 0 }}>
            {workspaceType === "consultant"
              ? "Create your first project to get started."
              : "Projects will appear here once you're added to one."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {allProjects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              workspaceType={workspaceType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

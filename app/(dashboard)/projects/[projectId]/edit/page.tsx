import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
import { db } from "@/lib/db/client";
import {
  projects,
  workspaces,
  actions,
  deliverables,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { IFC_CATEGORIES } from "@/lib/db/helpers";
import { NewActionModal } from "@/components/actions/new-action-modal";
import { PublishBar } from "@/components/projects/publish-bar";
import { getAllWorkspacesForClerkUser, resolveActiveWorkspace } from "@/lib/auth/active-workspace";
import type { IfcCategory } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionRow = {
  id: string;
  actionNumber: string;
  ifcCategory: IfcCategory;
  title: string;
  description: string | null;
  isPublished: boolean;
  priority: string | null;
  targetDate: Date | null;
  departmentHint: string | null;
  deliverableCount: number;
};

const IFC_CATEGORY_ORDER: IfcCategory[] = [
  "regulatory",
  "ps1",
  "ps2",
  "ps3",
  "ps4",
  "ps6",
  "ps8",
  "c1",
];

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getEditContext(projectId: string): Promise<{
  project: {
    id: string;
    name: string;
    isPublished: boolean;
    loaneeWorkspaceId: string;
    loaneeName: string;
    consultantName: string;
  };
  actionRows: ActionRow[];
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const allWorkspaces = await getAllWorkspacesForClerkUser(userId);
  const activeId = cookies().get("active_workspace")?.value;
  const active = resolveActiveWorkspace(allWorkspaces, activeId);

  if (!active || active.type !== "consultant" || active.role !== "admin") {
    return null;
  }

  const membership = { workspaceId: active.id, role: active.role, wsType: active.type };

  const loaneeWs = alias(workspaces, "loanee_ws");
  const consultantWs = alias(workspaces, "consultant_ws");

  const [project] = await db
    .select({
      id: projects.id,
      name: projects.name,
      isPublished: projects.isPublished,
      loaneeWorkspaceId: projects.loaneeWorkspaceId,
      loaneeName: loaneeWs.name,
      consultantName: consultantWs.name,
    })
    .from(projects)
    .innerJoin(loaneeWs, eq(projects.loaneeWorkspaceId, loaneeWs.id))
    .innerJoin(consultantWs, eq(projects.consultantWorkspaceId, consultantWs.id))
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.consultantWorkspaceId, membership.workspaceId),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (!project) return null;

  const actionData = await db
    .select({
      id: actions.id,
      actionNumber: actions.actionNumber,
      ifcCategory: actions.ifcCategory,
      title: actions.title,
      description: actions.description,
      isPublished: actions.isPublished,
      priority: actions.priority,
      targetDate: actions.targetDate,
      departmentHint: actions.departmentHint,
    })
    .from(actions)
    .where(and(eq(actions.projectId, projectId), isNull(actions.deletedAt)));

  if (actionData.length === 0) {
    return { project, actionRows: [] };
  }

  const actionIds = actionData.map((a) => a.id);

  const countRows = await db
    .select({
      actionId: deliverables.actionId,
      count: sql<number>`count(*)::int`,
    })
    .from(deliverables)
    .where(and(inArray(deliverables.actionId, actionIds), isNull(deliverables.deletedAt)))
    .groupBy(deliverables.actionId);

  const countMap = new Map(countRows.map((r) => [r.actionId, Number(r.count)]));

  const actionRows: ActionRow[] = actionData.map((a) => ({
    id: a.id,
    actionNumber: a.actionNumber,
    ifcCategory: a.ifcCategory,
    title: a.title,
    description: a.description,
    isPublished: a.isPublished,
    priority: a.priority,
    targetDate: a.targetDate,
    departmentHint: a.departmentHint,
    deliverableCount: countMap.get(a.id) ?? 0,
  }));

  return { project, actionRows };
}

// ─── Components ───────────────────────────────────────────────────────────────

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(date));
}

function StatusChip({ isPublished }: { isPublished: boolean }): JSX.Element {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 7px",
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        background: isPublished ? "var(--status-approved-bg)" : "var(--status-draft-bg)",
        color: isPublished ? "var(--status-approved-fg)" : "var(--status-draft-fg)",
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function EditActionsTable({
  actionRows,
  projectId,
  projectName,
  loaneeName,
}: {
  actionRows: ActionRow[];
  projectId: string;
  projectName: string;
  loaneeName: string;
}): JSX.Element {
  const grouped = new Map<IfcCategory, ActionRow[]>();
  for (const cat of IFC_CATEGORY_ORDER) {
    const catActions = actionRows.filter((a) => a.ifcCategory === cat);
    if (catActions.length > 0) grouped.set(cat, catActions);
  }

  const isEmpty = grouped.size === 0;

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
        <thead>
          <tr>
            {(
              [
                { label: "#", width: 56 },
                { label: "Category", width: 160 },
                { label: "Topic", width: undefined },
                { label: "Recommendation", width: undefined },
                { label: "Dept", width: 120 },
                { label: "Timeline", width: 100 },
                { label: "Deliverables", width: 90 },
                { label: "Status", width: 100 },
              ] as const
            ).map(({ label, width }) => (
              <th
                key={label}
                style={{
                  textAlign: "left",
                  padding: "10px 16px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--fg-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg)",
                  whiteSpace: "nowrap",
                  width: width ?? undefined,
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {isEmpty ? (
            <tr>
              <td
                colSpan={8}
                style={{
                  padding: "64px 24px",
                  textAlign: "center",
                  color: "var(--fg-tertiary)",
                  fontSize: 13,
                }}
              >
                No actions yet — add your first action to get started.
              </td>
            </tr>
          ) : (
            Array.from(grouped.entries()).map(([cat, catActions]) => (
              <Fragment key={cat}>
                <tr style={{ background: "var(--bg)", borderTop: "1px solid var(--border)" }}>
                  <td
                    colSpan={8}
                    style={{
                      padding: "8px 16px",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--fg-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        style={{ width: 10, height: 10, color: "var(--fg-tertiary)" }}
                      >
                        <path d="M4 6l4 4 4-4" />
                      </svg>
                      {IFC_CATEGORIES[cat]}
                      <span
                        style={{
                          color: "var(--fg-tertiary)",
                          fontWeight: 500,
                          textTransform: "none",
                          letterSpacing: 0,
                        }}
                      >
                        · {catActions.length} {catActions.length === 1 ? "Action" : "Actions"}
                      </span>
                    </span>
                  </td>
                </tr>
                {catActions.map((row) => (
                  <tr
                    key={row.id}
                    className="action-table-row"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <td
                      style={{
                        padding: "10px 16px",
                        verticalAlign: "top",
                        fontFamily: "ui-monospace, monospace",
                        color: "var(--fg-tertiary)",
                        fontSize: 11.5,
                        whiteSpace: "nowrap",
                        width: 56,
                      }}
                    >
                      {row.actionNumber}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        verticalAlign: "top",
                        fontSize: 11.5,
                        color: "var(--fg-secondary)",
                        width: 160,
                      }}
                    >
                      {IFC_CATEGORIES[row.ifcCategory]}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        verticalAlign: "top",
                        maxWidth: 200,
                      }}
                    >
                      <Link
                        href={`/projects/${projectId}/actions/${row.id}`}
                        style={{
                          fontWeight: 500,
                          color: "var(--fg)",
                          textDecoration: "none",
                        }}
                        className="action-title-link"
                      >
                        {row.title}
                      </Link>
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        verticalAlign: "top",
                        color: "var(--fg-secondary)",
                        maxWidth: 280,
                        fontSize: 12,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {row.description ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        verticalAlign: "top",
                        color: "var(--fg-secondary)",
                        fontSize: 12,
                        width: 120,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        maxWidth: 120,
                      }}
                    >
                      {row.departmentHint ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        verticalAlign: "top",
                        color: "var(--fg-secondary)",
                        fontSize: 12,
                        width: 100,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatDate(row.targetDate)}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        verticalAlign: "top",
                        textAlign: "center",
                        width: 90,
                        color: "var(--fg-secondary)",
                        fontVariantNumeric: "tabular-nums",
                        fontSize: 12,
                      }}
                    >
                      {row.deliverableCount}
                    </td>
                    <td style={{ padding: "10px 16px", verticalAlign: "top", width: 100 }}>
                      <StatusChip isPublished={row.isPublished} />
                    </td>
                  </tr>
                ))}
              </Fragment>
            ))
          )}
        </tbody>
      </table>

      {/* Add action row */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid var(--border)",
          display: "flex",
        }}
      >
        <NewActionModal
          projectId={projectId}
          projectName={projectName}
          loaneeName={loaneeName}
        />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function EditActionPlanPage({
  params,
}: {
  params: { projectId: string };
}): Promise<JSX.Element> {
  const ctx = await getEditContext(params.projectId);

  // Middleware ensures authentication; null ctx means non-admin or wrong workspace
  if (!ctx) redirect(`/projects/${params.projectId}`);

  const { project, actionRows } = ctx;

  const draftCount = actionRows.filter((a) => !a.isPublished).length;
  const publishedCount = actionRows.filter((a) => a.isPublished).length;

  // Build per-category draft counts for the publish modal
  const categoryCounts = IFC_CATEGORY_ORDER
    .map((cat) => ({
      label: IFC_CATEGORIES[cat],
      draftCount: actionRows.filter((a) => a.ifcCategory === cat && !a.isPublished).length,
    }))
    .filter((c) => c.draftCount > 0);

  return (
    <div style={{ margin: "-24px", paddingBottom: 64 }}>
      {/* Header */}
      <div style={{ padding: "20px 32px 0 32px" }}>
        {/* Breadcrumb */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
            fontSize: 12.5,
            color: "var(--fg-tertiary)",
          }}
        >
          <Link
            href="/projects"
            style={{ color: "var(--fg-tertiary)", textDecoration: "none" }}
          >
            Projects
          </Link>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 4l4 4-4 4" />
          </svg>
          <Link
            href={`/projects/${params.projectId}`}
            style={{ color: "var(--fg-tertiary)", textDecoration: "none" }}
          >
            {project.name}
          </Link>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M6 4l4 4-4 4" />
          </svg>
          <span style={{ color: "var(--fg)" }}>Action Plan</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div>
            <h2
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                margin: "0 0 4px",
                color: "var(--fg)",
              }}
            >
              Action Plan — {project.name}
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--fg-secondary)", margin: 0 }}>
              Draft, review, and publish actions for {project.loaneeName} to complete.
            </p>
          </div>
          <Link
            href={`/projects/${params.projectId}`}
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
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 4l-6 4 6 4" />
            </svg>
            Back to project
          </Link>
        </div>
      </div>

      {/* Actions table */}
      <EditActionsTable
        actionRows={actionRows}
        projectId={params.projectId}
        projectName={project.name}
        loaneeName={project.loaneeName}
      />

      {/* Publish bar (client component) */}
      <PublishBar
        projectId={params.projectId}
        loaneeName={project.loaneeName}
        isPublished={project.isPublished}
        draftCount={draftCount}
        publishedCount={publishedCount}
        categoryCounts={categoryCounts}
      />
    </div>
  );
}

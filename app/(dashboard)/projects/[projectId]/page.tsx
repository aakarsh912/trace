import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Fragment } from "react";
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
import { IFC_CATEGORIES } from "@/lib/db/helpers";
import { NewActionModal } from "@/components/actions/new-action-modal";
import { EditActionModal } from "@/components/actions/edit-action-modal";
import { getAllWorkspacesForClerkUser, resolveActiveWorkspace } from "@/lib/auth/active-workspace";
import type { WorkspaceType, IfcCategory } from "@/lib/db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

type DisplayStatus =
  | "draft"
  | "todo"
  | "progress"
  | "submitted"
  | "approved"
  | "returned";

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

// ─── Constants ────────────────────────────────────────────────────────────────

const IFC_CATEGORY_ORDER: IfcCategory[] = [
  "regulatory",
  "c1",
  "ps1",
  "ps2",
  "ps3",
  "ps4",
  "ps5",
  "ps6",
  "ps7",
  "ps8",
];

const IFC_SHORT_LABEL: Record<IfcCategory, string> = {
  regulatory: "RC",
  c1: "C1",
  ps1: "PS1",
  ps2: "PS2",
  ps3: "PS3",
  ps4: "PS4",
  ps5: "PS5",
  ps6: "PS6",
  ps7: "PS7",
  ps8: "PS8",
};

type BoardColumnKey = "draft" | "progress" | "submitted" | "returned" | "approved";

const BOARD_COLUMNS: {
  key: BoardColumnKey;
  label: string;
  dotColor: string;
  statuses: DisplayStatus[];
  attention?: boolean;
}[] = [
  { key: "draft",     label: "Draft",       dotColor: "var(--status-draft-fg)",     statuses: ["draft"] },
  { key: "progress",  label: "In Progress",  dotColor: "var(--status-progress-fg)",  statuses: ["todo", "progress"] },
  { key: "submitted", label: "Submitted",    dotColor: "var(--status-submitted-fg)", statuses: ["submitted"] },
  { key: "returned",  label: "Returned",     dotColor: "var(--status-returned-fg)",  statuses: ["returned"], attention: true },
  { key: "approved",  label: "Approved",     dotColor: "var(--status-approved-fg)",  statuses: ["approved"] },
];

const STATUS_CONFIG: Record<
  DisplayStatus,
  { label: string; bg: string; fg: string }
> = {
  draft: {
    label: "Draft",
    bg: "var(--status-draft-bg)",
    fg: "var(--status-draft-fg)",
  },
  todo: {
    label: "Action Items",
    bg: "var(--status-todo-bg)",
    fg: "var(--status-todo-fg)",
  },
  progress: {
    label: "In Progress",
    bg: "var(--status-progress-bg)",
    fg: "var(--status-progress-fg)",
  },
  submitted: {
    label: "Submitted",
    bg: "var(--status-submitted-bg)",
    fg: "var(--status-submitted-fg)",
  },
  approved: {
    label: "Approved",
    bg: "var(--status-approved-bg)",
    fg: "var(--status-approved-fg)",
  },
  returned: {
    label: "Sent Back",
    bg: "var(--status-returned-bg)",
    fg: "var(--status-returned-fg)",
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDisplayStatus(row: ActionRow): DisplayStatus {
  if (!row.isPublished) return "draft";
  if (row.total === 0) return "todo";
  if (row.sentBack > 0) return "returned";
  if (row.approved === row.total) return "approved";
  if (row.pending === row.total) return "todo";
  if (row.submitted > 0 && row.pending === 0) return "submitted";
  return "progress";
}

function getDotsData(
  row: ActionRow
): Array<"done" | "warning" | "empty"> {
  const dotCount = Math.min(row.total, 3);
  const dots: Array<"done" | "warning" | "empty"> = [];
  const approvedDots = Math.min(row.approved, dotCount);
  for (let i = 0; i < approvedDots; i++) dots.push("done");
  const sentBackDots = Math.min(row.sentBack, dotCount - approvedDots);
  for (let i = 0; i < sentBackDots; i++) dots.push("warning");
  const empty = dotCount - approvedDots - sentBackDots;
  for (let i = 0; i < empty; i++) dots.push("empty");
  return dots;
}

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

async function getActionsForProject(
  projectId: string,
  workspaceType: WorkspaceType
): Promise<ActionRow[]> {
  const conditions = [
    eq(actions.projectId, projectId),
    isNull(actions.deletedAt),
  ];
  if (workspaceType === "loanee") {
    conditions.push(eq(actions.isPublished, true));
  }

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

// ─── Components ───────────────────────────────────────────────────────────────

function StatusChip({ row }: { row: ActionRow }): JSX.Element {
  const status = getDisplayStatus(row);
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 8px",
        borderRadius: 4,
        fontSize: 11.5,
        fontWeight: 500,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        background: cfg.bg,
        color: cfg.fg,
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
      {cfg.label}
    </span>
  );
}

function DeliverableProgress({ row }: { row: ActionRow }): JSX.Element {
  const dots = getDotsData(row);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 3,
        fontVariantNumeric: "tabular-nums",
        fontSize: 11.5,
        color: "var(--fg-secondary)",
      }}
    >
      {row.approved}/{row.total}
      <span style={{ display: "inline-flex", gap: 2, marginLeft: 2 }}>
        {dots.map((d, i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background:
                d === "done"
                  ? "var(--status-approved-fg)"
                  : d === "warning"
                  ? "var(--status-returned-fg)"
                  : "var(--bg-subtle)",
              border:
                d === "empty"
                  ? "1px solid var(--border)"
                  : d === "done"
                  ? "1px solid var(--status-approved-fg)"
                  : "1px solid var(--status-returned-fg)",
            }}
          />
        ))}
      </span>
    </span>
  );
}

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
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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

function Toolbar({
  view,
  projectId,
}: {
  view: "board" | "table";
  projectId: string;
}): JSX.Element {
  const VIEWS = [
    {
      key: "board" as const,
      label: "Board",
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
          <rect x="1" y="2" width="4" height="12" rx="0.5" />
          <rect x="6" y="2" width="4" height="12" rx="0.5" />
          <rect x="11" y="2" width="4" height="12" rx="0.5" />
        </svg>
      ),
    },
    {
      key: "table" as const,
      label: "Table",
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 13, height: 13 }}>
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 32px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* View switcher */}
      <div
        style={{
          display: "inline-flex",
          background: "var(--bg-subtle)",
          borderRadius: "var(--radius)",
          padding: 2,
        }}
      >
        {VIEWS.map(({ key, label, icon }) => (
          <Link
            key={key}
            href={`/projects/${projectId}?view=${key}`}
            className={view === key ? "view-switcher-btn active" : "view-switcher-btn"}
            style={{ textDecoration: "none" }}
          >
            {icon}
            {label}
          </Link>
        ))}
      </div>

      {/* Filter chips */}
      <button className="filter-chip-btn">
        IFC Category
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      <button className="filter-chip-btn">
        Status: All
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {/* Spacer + search */}
      <div style={{ marginLeft: "auto" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "4px 10px",
            background: "var(--bg-surface)",
            width: 180,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4" />
            <path d="M10 10l3 3" />
          </svg>
          <input
            placeholder="Search actions…"
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 12.5,
              color: "var(--fg)",
              fontFamily: "inherit",
              width: "100%",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Board view ──────────────────────────────────────────────────────────────

function DeliverableDots({ row }: { row: ActionRow }): JSX.Element {
  if (row.total === 0) {
    return (
      <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>No deliverables</span>
    );
  }
  const dots: { color: string; border: string }[] = [];
  for (let i = 0; i < row.approved; i++)
    dots.push({ color: "var(--status-approved-fg)", border: "var(--status-approved-fg)" });
  for (let i = 0; i < row.submitted; i++)
    dots.push({ color: "var(--status-submitted-fg)", border: "var(--status-submitted-fg)" });
  for (let i = 0; i < row.sentBack; i++)
    dots.push({ color: "var(--status-returned-fg)", border: "var(--status-returned-fg)" });
  for (let i = 0; i < row.pending; i++)
    dots.push({ color: "transparent", border: "var(--border-strong)" });

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {dots.map((d, i) => (
        <span
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: d.color,
            border: `1.5px solid ${d.border}`,
            flexShrink: 0,
          }}
        />
      ))}
    </span>
  );
}

function formatTargetDate(date: Date): string {
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

function BoardCard({ row, projectId }: { row: ActionRow; projectId: string }): JSX.Element {
  const status = getDisplayStatus(row);
  const isReturned = status === "returned";
  const isApproved = status === "approved";
  const hasAssignee = row.assigneeFirstName !== null || row.assigneeLastName !== null;
  const assigneeInitials = (
    (row.assigneeFirstName?.[0] ?? "") + (row.assigneeLastName?.[0] ?? "")
  ).toUpperCase() || "?";

  return (
    <Link
      href={`/projects/${projectId}/actions/${row.id}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        padding: "10px 12px",
        background: isReturned ? "#FFFBF4" : "var(--bg-surface)",
        border: `1px solid ${isReturned ? "#E8D0A8" : "var(--border)"}`,
        borderRadius: "var(--radius)",
        textDecoration: "none",
        color: "var(--fg)",
        transition: "border-color 80ms, box-shadow 80ms",
        opacity: isApproved ? 0.7 : 1,
        cursor: "pointer",
      }}
      className="board-card"
    >
      {/* Top row: action number + IFC chip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: "ui-monospace, monospace",
          fontSize: 10.5,
          color: "var(--fg-tertiary)",
        }}
      >
        <span>{row.actionNumber}</span>
        <span
          style={{
            marginLeft: "auto",
            padding: "1px 5px",
            background: "var(--bg-subtle)",
            borderRadius: 3,
            color: "var(--fg-secondary)",
          }}
        >
          {IFC_SHORT_LABEL[row.ifcCategory]}
        </span>
      </div>

      {/* Title */}
      <p
        style={{
          margin: 0,
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.35,
          color: "var(--fg)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {row.title}
      </p>

      {/* Deliverable dots */}
      {row.total > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <DeliverableDots row={row} />
          <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
            {row.approved}/{row.total}
          </span>
        </div>
      )}

      {/* Footer: dept + due date + assignee */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          paddingTop: 6,
          borderTop: "1px dashed var(--border)",
          marginTop: 1,
          minWidth: 0,
        }}
      >
        {/* Dept hint */}
        {row.departmentHint && (
          <span
            style={{
              padding: "1px 6px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: 3,
              fontSize: 10.5,
              color: "var(--fg-secondary)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: 90,
              flexShrink: 1,
            }}
          >
            {row.departmentHint}
          </span>
        )}

        {/* Due date */}
        <span
          style={{
            fontSize: 11,
            color: row.targetDate ? "var(--fg-secondary)" : "var(--fg-tertiary)",
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {row.targetDate ? formatTargetDate(row.targetDate) : "No date"}
        </span>

        {/* Assignee avatar — pushed right */}
        <span style={{ marginLeft: "auto", flexShrink: 0 }}>
          {hasAssignee ? (
            <span
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "#5B7FA3",
                color: "white",
                fontSize: 9,
                fontWeight: 600,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                letterSpacing: "-0.02em",
              }}
            >
              {assigneeInitials}
            </span>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="var(--fg-tertiary)"
              strokeWidth="1.3"
            >
              <circle cx="8" cy="6" r="3" />
              <path d="M2 14c1-3 4-4 6-4s5 1 6 4" />
            </svg>
          )}
        </span>
      </div>
    </Link>
  );
}

function ActionsBoard({
  actionRows,
  projectId,
}: {
  actionRows: ActionRow[];
  projectId: string;
}): JSX.Element {
  return (
    <div
      style={{
        display: "grid",
        gridAutoColumns: 290,
        gridAutoFlow: "column",
        gap: 10,
        padding: "16px 24px 40px 24px",
        overflowX: "auto",
        background: "var(--bg)",
        alignItems: "start",
      }}
    >
      {BOARD_COLUMNS.map((col) => {
        const colActions = actionRows.filter(
          (a) => (col.statuses as string[]).includes(getDisplayStatus(a))
        );
        const colBg = col.attention ? "#FBF1E599" : "var(--bg-subtle)";
        const colBorder = col.attention ? "1px solid #E8D0A870" : "none";
        const headerBg = col.attention ? "#FBF1E5" : "var(--bg-subtle)";
        const headerBorderBottom = col.attention ? "1px solid #E8D0A8" : "1px solid var(--border)";
        return (
          <div
            key={col.key}
            style={{
              display: "flex",
              flexDirection: "column",
              background: colBg,
              border: colBorder,
              borderRadius: "var(--radius-lg)",
            }}
          >
            {/* Column header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px 12px",
                borderBottom: headerBorderBottom,
                gap: 8,
                background: headerBg,
                borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: col.dotColor,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--fg)",
                }}
              >
                {col.label}
              </span>
              <span
                style={{
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--fg-tertiary)",
                  fontWeight: 500,
                }}
              >
                {colActions.length}
              </span>
            </div>

            {/* Column body */}
            <div
              style={{
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {colActions.length === 0 ? (
                <div
                  style={{
                    padding: "16px 8px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "var(--fg-tertiary)",
                  }}
                >
                  No actions
                </div>
              ) : (
                colActions.map((row) => (
                  <BoardCard key={row.id} row={row} projectId={projectId} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionsTable({
  actionRows,
  projectId,
  isConsultant,
  projectName,
  loaneeName,
}: {
  actionRows: ActionRow[];
  projectId: string;
  isConsultant: boolean;
  projectName: string;
  loaneeName: string;
}): JSX.Element {
  // Group by IFC category in the correct order
  const grouped = new Map<IfcCategory, ActionRow[]>();
  for (const cat of IFC_CATEGORY_ORDER) {
    const catActions = actionRows.filter((a) => a.ifcCategory === cat);
    if (catActions.length > 0) grouped.set(cat, catActions);
  }

  if (grouped.size === 0) {
    return (
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
          <path d="M8 2v12M2 8h12" />
        </svg>
        <p
          style={{
            fontSize: 13,
            margin: 0,
            fontWeight: 500,
            color: "var(--fg-secondary)",
          }}
        >
          No actions yet
        </p>
        <p style={{ fontSize: 12, margin: 0 }}>
          The action plan hasn&apos;t been published yet.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12.5,
        }}
      >
        <thead>
          <tr>
            {(
              [
                { label: "#", width: 56 },
                { label: "Status", width: 130 },
                { label: "Topic", width: undefined },
                { label: "Recommendation", width: undefined },
                { label: "Deliverables", width: 90 },
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
          {Array.from(grouped.entries()).map(([cat, catActions]) => (
            <Fragment key={cat}>
              {/* Group header row */}
              <tr
                style={{
                  background: "var(--bg)",
                  borderTop: "1px solid var(--border)",
                }}
              >
                <td
                  colSpan={5}
                  style={{
                    padding: "8px 16px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--fg-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <svg
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      style={{
                        width: 10,
                        height: 10,
                        color: "var(--fg-tertiary)",
                      }}
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
                      · {catActions.length}{" "}
                      {catActions.length === 1 ? "Action" : "Actions"}
                    </span>
                  </span>
                </td>
              </tr>

              {/* Action rows */}
              {catActions.map((row) => (
                <ActionTableRow
                  key={row.id}
                  row={row}
                  projectId={projectId}
                  isConsultant={isConsultant}
                  projectName={projectName}
                  loaneeName={loaneeName}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ActionTableRow({
  row,
  projectId,
  isConsultant,
  projectName,
  loaneeName,
}: {
  row: ActionRow;
  projectId: string;
  isConsultant: boolean;
  projectName: string;
  loaneeName: string;
}): JSX.Element {
  const isDraft = !row.isPublished;
  return (
    <tr
      className="action-table-row"
      style={{
        borderBottom: "1px solid var(--border)",
        opacity: isDraft ? 0.55 : 1,
      }}
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
          width: 130,
        }}
      >
        <StatusChip row={row} />
      </td>
      <td
        style={{
          padding: "10px 16px",
          verticalAlign: "top",
          maxWidth: 260,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Link
            href={`/projects/${projectId}/actions/${row.id}`}
            style={{ fontWeight: 500, color: "var(--fg)", textDecoration: "none" }}
            className="action-title-link"
          >
            {row.title}
          </Link>
          {isConsultant && (
            <EditActionModal
              actionId={row.id}
              projectId={projectId}
              projectName={projectName}
              loaneeName={loaneeName}
            />
          )}
        </div>
      </td>
      <td
        style={{
          padding: "10px 16px",
          verticalAlign: "top",
          color: "var(--fg-secondary)",
          maxWidth: 380,
          fontSize: 12,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {row.description ?? "—"}
      </td>
      <td
        style={{
          padding: "10px 16px",
          verticalAlign: "top",
          textAlign: "center",
          width: 90,
        }}
      >
        <DeliverableProgress row={row} />
      </td>
    </tr>
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
    getActionsForProject(params.projectId, workspaceType),
  ]);

  if (!project) notFound();

  // Aggregate deliverable totals for the header progress bar
  const totalDeliverables = actionRows.reduce((s, a) => s + a.total, 0);
  const approvedDeliverables = actionRows.reduce((s, a) => s + a.approved, 0);
  const submittedDeliverables = actionRows.reduce((s, a) => s + a.submitted, 0);
  const pendingDeliverables = actionRows.reduce((s, a) => s + a.pending, 0);
  const sentBackDeliverables = actionRows.reduce((s, a) => s + a.sentBack, 0);

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
      <Toolbar view={view} projectId={params.projectId} />
      {view === "board" ? (
        <ActionsBoard actionRows={actionRows} projectId={params.projectId} />
      ) : (
        <ActionsTable
          actionRows={actionRows}
          projectId={params.projectId}
          isConsultant={workspaceType === "consultant"}
          projectName={project.name}
          loaneeName={project.loaneeName}
        />
      )}
    </div>
  );
}

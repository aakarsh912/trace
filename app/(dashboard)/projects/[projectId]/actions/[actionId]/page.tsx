import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import {
  users,
  workspaceMembers,
  workspaces,
  projects,
  actions,
  deliverables,
  documents,
  reviews,
  comments,
  activityLog,
} from "@/lib/db/schema";
import type {
  WorkspaceType,
  WorkspaceMemberRole,
  IfcCategory,
  DeliverableStatus,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray, or, desc } from "drizzle-orm";
import { IFC_CATEGORIES } from "@/lib/db/helpers";
import { can } from "@/lib/auth/permissions";
import { ReviewControls } from "@/components/actions/review-controls";
import { CommentComposer } from "@/components/actions/comment-composer";
import { UploadButton } from "@/components/actions/upload-button";
import { DownloadLink } from "@/components/actions/download-link";
import { CommentItem } from "@/components/actions/comment-item";
import { AssigneeChip } from "@/components/actions/assignee-chip";
import type { AssigneeMember } from "@/components/actions/assignee-chip";
import { RemoveDocumentButton } from "@/components/actions/remove-document-button";
import { SubmitActionBar } from "@/components/actions/submit-action-bar";
import { EditActionModal } from "@/components/actions/edit-action-modal";
import { EstimatedCostField } from "@/components/actions/estimated-cost-field";

// ── Types ────────────────────────────────────────────────────────────────────

type WsContext = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  role: WorkspaceMemberRole;
  firstName: string | null;
  lastName: string | null;
};

type DeliverableRow = {
  id: string;
  letter: string;
  description: string;
  status: DeliverableStatus;
  doc: {
    id: string;
    fileName: string;
    version: number;
    fileSize: number | null;
    uploadedAt: Date;
    uploadedById: string | null;
  } | null;
  review: {
    decision: "approved" | "sent_back";
    comment: string | null;
    createdAt: Date;
    reviewerName: string;
  } | null;
};

type CommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  editedAt: Date | null;
  deletedAt: Date | null;
  authorId: string | null;
  authorName: string;
  workspaceType: WorkspaceType | null;
  workspaceName: string | null;
};

type ActivityLogRow = {
  id: string;
  eventType: string;
  metadata: string | null;
  createdAt: Date;
  actorFirstName: string | null;
  actorLastName: string | null;
};

type ActionData = {
  id: string;
  projectId: string;
  projectName: string;
  loaneeName: string;
  bankWorkspaceId: string;
  consultantWorkspaceId: string;
  assignedTo: AssigneeMember | null;
  departmentHint: string | null;
  estimatedCost: string | null;
  loaneeWorkspaceId: string;
  actionNumber: string;
  ifcCategory: IfcCategory;
  title: string;
  description: string | null;
  isPublished: boolean;
  deliverables: DeliverableRow[];
  comments: CommentRow[];
  activityEntries: ActivityLogRow[];
};

// ── Helpers ──────────────────────────────────────────────────────────────────

type DisplayStatus = "draft" | "progress" | "submitted" | "returned" | "approved";

function getDisplayStatus(
  delivs: { status: DeliverableStatus }[],
  isPublished: boolean
): DisplayStatus {
  if (!isPublished) return "draft";
  if (delivs.length === 0) return "progress";
  if (delivs.every((d) => d.status === "approved")) return "approved";
  if (delivs.some((d) => d.status === "sent_back")) return "returned";
  if (delivs.some((d) => d.status === "submitted")) return "submitted";
  return "progress";
}

const STATUS_CHIP: Record<
  DisplayStatus,
  { label: string; bg: string; fg: string }
> = {
  draft: {
    label: "Draft",
    bg: "var(--status-draft-bg)",
    fg: "var(--status-draft-fg)",
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
  returned: {
    label: "Returned",
    bg: "var(--status-returned-bg)",
    fg: "var(--status-returned-fg)",
  },
  approved: {
    label: "Approved",
    bg: "var(--status-approved-bg)",
    fg: "var(--status-approved-fg)",
  },
};

const IFC_CHIP_LABEL: Record<IfcCategory, string> = {
  regulatory: "Regulatory",
  c1: "General",
  ps1: "PS1 · Assessment",
  ps2: "PS2 · Labor",
  ps3: "PS3 · Resource",
  ps4: "PS4 · Community",
  ps5: "PS5 · Land",
  ps6: "PS6 · Biodiversity",
  ps7: "PS7 · Indigenous",
  ps8: "PS8 · Cultural",
};

function getInitials(
  firstName: string | null,
  lastName: string | null
): string {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function getActivityLabel(eventType: string): string {
  switch (eventType) {
    case "action.assigned": return "assigned this action";
    case "action.unassigned": return "unassigned this action";
    case "action.submitted": return "submitted for review";
    case "action.edited": return "updated this action";
    case "document_uploaded": return "uploaded a document";
    case "document_removed": return "removed a document";
    case "deliverable_approved": return "approved a deliverable";
    case "deliverable_sent_back": return "sent a deliverable back";
    default: return eventType.replace(/[._]/g, " ");
  }
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function getWsContext(clerkUserId: string): Promise<WsContext | null> {
  const [row] = await db
    .select({
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
      role: workspaceMembers.role,
    })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(users.clerkUserId, clerkUserId),
        isNull(users.deletedAt),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1);

  return row ?? null;
}

async function getActionData(
  projectId: string,
  actionId: string,
  wsCtx: WsContext
): Promise<ActionData | null> {
  // Workspace access condition
  const wsColumn =
    wsCtx.workspaceType === "bank"
      ? projects.bankWorkspaceId
      : wsCtx.workspaceType === "consultant"
      ? projects.consultantWorkspaceId
      : projects.loaneeWorkspaceId;

  const [actionRow] = await db
    .select({
      actionId: actions.id,
      actionNumber: actions.actionNumber,
      ifcCategory: actions.ifcCategory,
      title: actions.title,
      description: actions.description,
      isPublished: actions.isPublished,
      departmentHint: actions.departmentHint,
      estimatedCost: actions.estimatedCost,
      assignedToId: actions.assignedToId,
      projectId: projects.id,
      projectName: projects.name,
      bankWorkspaceId: projects.bankWorkspaceId,
      consultantWorkspaceId: projects.consultantWorkspaceId,
      loaneeWorkspaceId: projects.loaneeWorkspaceId,
    })
    .from(actions)
    .innerJoin(projects, eq(actions.projectId, projects.id))
    .where(
      and(
        eq(actions.id, actionId),
        eq(projects.id, projectId),
        eq(wsColumn, wsCtx.workspaceId),
        isNull(actions.deletedAt),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (!actionRow) return null;

  // Deliverables
  const delivRows = await db
    .select({
      id: deliverables.id,
      letter: deliverables.letter,
      description: deliverables.description,
      status: deliverables.status,
    })
    .from(deliverables)
    .where(
      and(
        eq(deliverables.actionId, actionId),
        isNull(deliverables.deletedAt)
      )
    )
    .orderBy(deliverables.letter);

  const delivIds = delivRows.map((d) => d.id);

  // Current documents per deliverable
  const docRows =
    delivIds.length > 0
      ? await db
          .select({
            id: documents.id,
            deliverableId: documents.deliverableId,
            fileName: documents.fileName,
            version: documents.version,
            fileSize: documents.fileSize,
            uploadedAt: documents.uploadedAt,
            uploadedById: documents.uploadedById,
          })
          .from(documents)
          .where(
            and(
              inArray(documents.deliverableId, delivIds),
              eq(documents.isCurrent, true),
              isNull(documents.deletedAt)
            )
          )
      : [];

  // Reviews with reviewer name
  const reviewRows =
    delivIds.length > 0
      ? await db
          .select({
            deliverableId: reviews.deliverableId,
            decision: reviews.decision,
            comment: reviews.comment,
            createdAt: reviews.createdAt,
            reviewerFirstName: users.firstName,
            reviewerLastName: users.lastName,
          })
          .from(reviews)
          .leftJoin(users, eq(reviews.reviewedById, users.id))
          .where(inArray(reviews.deliverableId, delivIds))
          .orderBy(reviews.createdAt)
      : [];

  // Build doc map and review map (latest review per deliverable)
  const docMap = new Map<string, (typeof docRows)[0]>();
  for (const d of docRows) {
    docMap.set(d.deliverableId, d);
  }

  const reviewMap = new Map<string, (typeof reviewRows)[0]>();
  for (const r of reviewRows) {
    reviewMap.set(r.deliverableId, r); // later entries overwrite → latest review
  }

  const enrichedDeliverables: DeliverableRow[] = delivRows.map((d) => {
    const doc = docMap.get(d.id);
    const rev = reviewMap.get(d.id);
    return {
      id: d.id,
      letter: d.letter,
      description: d.description,
      status: d.status,
      doc: doc
        ? {
            id: doc.id,
            fileName: doc.fileName,
            version: doc.version,
            fileSize: doc.fileSize,
            uploadedAt: doc.uploadedAt,
            uploadedById: doc.uploadedById,
          }
        : null,
      review: rev
        ? {
            decision: rev.decision,
            comment: rev.comment,
            createdAt: rev.createdAt,
            reviewerName:
              `${rev.reviewerFirstName ?? ""} ${rev.reviewerLastName ?? ""}`.trim() ||
              "Reviewer",
          }
        : null,
    };
  });

  // Comments with author workspace info
  const projectWsIds = [
    actionRow.bankWorkspaceId,
    actionRow.consultantWorkspaceId,
    actionRow.loaneeWorkspaceId,
  ];

  const commentRows = await db
    .select({
      id: comments.id,
      body: comments.body,
      createdAt: comments.createdAt,
      editedAt: comments.editedAt,
      deletedAt: comments.deletedAt,
      authorId: comments.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      workspaceType: workspaces.type,
      workspaceName: workspaces.name,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .leftJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.userId, users.id),
        isNull(workspaceMembers.deletedAt),
        inArray(workspaceMembers.workspaceId, projectWsIds)
      )
    )
    .leftJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(comments.actionId, actionId))
    .orderBy(comments.createdAt);

  const enrichedComments: CommentRow[] = commentRows.map((c) => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    editedAt: c.editedAt,
    deletedAt: c.deletedAt,
    authorId: c.authorId,
    authorName:
      `${c.authorFirstName ?? ""} ${c.authorLastName ?? ""}`.trim() || "User",
    workspaceType: c.workspaceType ?? null,
    workspaceName: c.workspaceName ?? null,
  }));

  // Resolve assignee name if set
  let assignedTo: AssigneeMember | null = null;
  if (actionRow.assignedToId) {
    const [assigneeRow] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, actionRow.assignedToId))
      .limit(1);
    assignedTo = assigneeRow ?? null;
  }

  // Activity log — action-level events + deliverable-level events for this action
  const activityWhere =
    delivIds.length > 0
      ? or(
          and(eq(activityLog.entityId, actionId), eq(activityLog.entityType, "action")),
          and(
            inArray(activityLog.entityId, delivIds),
            eq(activityLog.entityType, "deliverable")
          )
        )
      : and(eq(activityLog.entityId, actionId), eq(activityLog.entityType, "action"));

  const activityRows = await db
    .select({
      id: activityLog.id,
      eventType: activityLog.eventType,
      metadata: activityLog.metadata,
      createdAt: activityLog.createdAt,
      actorFirstName: users.firstName,
      actorLastName: users.lastName,
    })
    .from(activityLog)
    .leftJoin(users, eq(activityLog.actorId, users.id))
    .where(activityWhere)
    .orderBy(desc(activityLog.createdAt))
    .limit(10);

  // Loanee workspace name (for EditActionModal placeholder text)
  const [loaneeWsRow] = await db
    .select({ name: workspaces.name })
    .from(workspaces)
    .where(eq(workspaces.id, actionRow.loaneeWorkspaceId))
    .limit(1);

  return {
    id: actionRow.actionId,
    projectId: actionRow.projectId,
    projectName: actionRow.projectName,
    loaneeName: loaneeWsRow?.name ?? "loanee",
    bankWorkspaceId: actionRow.bankWorkspaceId,
    consultantWorkspaceId: actionRow.consultantWorkspaceId,
    loaneeWorkspaceId: actionRow.loaneeWorkspaceId,
    actionNumber: actionRow.actionNumber,
    ifcCategory: actionRow.ifcCategory,
    title: actionRow.title,
    description: actionRow.description,
    isPublished: actionRow.isPublished,
    departmentHint: actionRow.departmentHint ?? null,
    estimatedCost: actionRow.estimatedCost ?? null,
    assignedTo,
    deliverables: enrichedDeliverables,
    comments: enrichedComments,
    activityEntries: activityRows,
  };
}

async function getLoaneeMembers(loaneeWorkspaceId: string): Promise<AssigneeMember[]> {
  return db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(
      and(
        eq(workspaceMembers.workspaceId, loaneeWorkspaceId),
        isNull(workspaceMembers.deletedAt),
        isNull(users.deletedAt)
      )
    );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusChipEl({ status }: { status: DisplayStatus }): JSX.Element {
  const chip = STATUS_CHIP[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 8px",
        borderRadius: 99,
        fontSize: 11.5,
        fontWeight: 500,
        background: chip.bg,
        color: chip.fg,
        whiteSpace: "nowrap",
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: chip.fg,
          flexShrink: 0,
        }}
      />
      {chip.label}
    </span>
  );
}

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        color: "var(--fg-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        marginBottom: 8,
      }}
    >
      {children}
    </div>
  );
}

function DeliverableCard({
  deliverable,
  workspaceType,
  role,
  currentUserId,
}: {
  deliverable: DeliverableRow;
  workspaceType: WorkspaceType;
  role: WorkspaceMemberRole;
  currentUserId: string;
}): JSX.Element {
  const { id, letter, description, status, doc, review } = deliverable;
  const isConsultant = workspaceType === "consultant";
  const isLoanee = workspaceType === "loanee";
  const canReview =
    isConsultant &&
    status === "submitted" &&
    can(workspaceType, role, "review:approve");
  const canUpload =
    isLoanee &&
    (status === "pending" || status === "sent_back") &&
    can(workspaceType, role, "document:upload");

  const checkClass =
    status === "approved"
      ? "deliverable-check approved"
      : status === "sent_back"
      ? "deliverable-check needs-work"
      : status === "submitted"
      ? "deliverable-check checked"
      : "deliverable-check";

  const highlight: React.CSSProperties =
    canReview
      ? { borderColor: "#D4C5EC", boxShadow: "0 0 0 3px #EFE9F580" }
      : isLoanee && status === "sent_back"
      ? { borderColor: "#E8D0A8", boxShadow: "0 0 0 3px #FBF1E580" }
      : {};

  const textColor =
    status === "approved" ? "var(--fg-secondary)" : "var(--fg)";

  return (
    <div
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        ...highlight,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          padding: "14px 16px",
        }}
      >
        <div className={checkClass} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: textColor }}>
            <strong style={{ fontWeight: 500, color: "var(--fg-secondary)" }}>
              ({letter})
            </strong>{" "}
            {description}
          </div>

          <div style={{ marginTop: 6 }}>
            {status === "approved" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "11.5px",
                  fontWeight: 500,
                  color: "var(--status-approved-fg)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 8l3.5 3.5L13 5" />
                </svg>
                {review
                  ? `Approved by ${review.reviewerName} · ${formatDate(review.createdAt)}`
                  : "Approved"}
              </span>
            )}
            {status === "submitted" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "11.5px",
                  fontWeight: 500,
                  color: "var(--status-submitted-fg)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="8" cy="8" r="6" />
                  <path d="M8 5v3l2 2" />
                </svg>
                {doc
                  ? `Submitted · ${doc.fileName}`
                  : "Submitted for review"}
              </span>
            )}
            {status === "sent_back" && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: "11.5px",
                  fontWeight: 500,
                  color: "var(--status-returned-fg)",
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M8 4v5M8 12v.01" />
                  <circle cx="8" cy="8" r="6" />
                </svg>
                Needs work
                {review?.comment && (
                  <span
                    style={{ color: "var(--fg-tertiary)", fontWeight: 400 }}
                  >
                    {" "}
                    — {review.comment}
                  </span>
                )}
              </span>
            )}
            {status === "pending" && (
              <span
                style={{ fontSize: "11.5px", color: "var(--fg-tertiary)" }}
              >
                Not yet submitted
              </span>
            )}
          </div>
        </div>

        {/* Right-side actions */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          {status === "approved" && isLoanee && (
            <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
              Locked
            </span>
          )}
          {status === "approved" && isConsultant && (
            <button
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 8px",
                fontSize: 11.5,
                fontFamily: "inherit",
                cursor: "pointer",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                color: "var(--fg-secondary)",
              }}
              title="Remove approval"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M3 8a5 5 0 0 1 9-3M12 3v3h-3" />
              </svg>
              Remove approval
            </button>
          )}
        </div>
      </div>

      {/* Uploaded document */}
      {doc && (
        <div
          style={{
            padding: "12px 16px 14px 46px",
            borderTop: "1px dashed var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: 12.5,
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
              <path d="M4 2h5l3 3v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" />
              <path d="M9 2v3h3" />
            </svg>
            <DownloadLink documentId={doc.id} fileName={doc.fileName} />
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 10.5,
                padding: "1px 5px",
                background: "var(--bg-subtle)",
                borderRadius: 3,
                color: "var(--fg-secondary)",
                flexShrink: 0,
              }}
            >
              v{doc.version}
            </span>
            {isLoanee && status !== "approved" && (
              <RemoveDocumentButton
                deliverableId={id}
                uploadedById={doc.uploadedById}
                currentUserId={currentUserId}
              />
            )}
          </div>
        </div>
      )}

      {/* Upload zone — loanee on pending/sent_back */}
      {canUpload && (
        <div
          style={{
            padding: "12px 16px 14px 46px",
            borderTop: "1px dashed var(--border)",
          }}
        >
          <UploadButton
            key={doc?.id ?? "no-doc"}
            deliverableId={id}
            label={status === "sent_back" ? "Upload new version" : "Upload evidence"}
          />
        </div>
      )}

      {/* Review controls — consultant on submitted */}
      {canReview && <ReviewControls deliverableId={id} />}
    </div>
  );
}


function MetaRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        fontSize: 13,
      }}
    >
      <span
        style={{
          width: 88,
          color: "var(--fg-tertiary)",
          fontSize: 12,
          flexShrink: 0,
          paddingTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ flex: 1, color: "var(--fg)", minWidth: 0 }}>
        {children}
      </span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ActionPage({
  params,
}: {
  params: { projectId: string; actionId: string };
}): Promise<JSX.Element> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const wsCtx = await getWsContext(userId);
  if (!wsCtx) redirect("/login");

  const data = await getActionData(params.projectId, params.actionId, wsCtx);
  if (!data) notFound();

  // Loanee can't see unpublished actions
  if (wsCtx.workspaceType === "loanee" && !data.isPublished) notFound();

  // Fetch loanee members for the assignee picker (loanee workspace only)
  const loaneeMembers =
    wsCtx.workspaceType === "loanee"
      ? await getLoaneeMembers(data.loaneeWorkspaceId)
      : [];

  const displayStatus = getDisplayStatus(data.deliverables, data.isPublished);
  const approvedCount = data.deliverables.filter(
    (d) => d.status === "approved"
  ).length;
  const sentBackCount = data.deliverables.filter(
    (d) => d.status === "sent_back"
  ).length;
  const totalCount = data.deliverables.length;

  const isConsultant = wsCtx.workspaceType === "consultant";
  const isLoanee = wsCtx.workspaceType === "loanee";
  const hasConsultantFooter = isConsultant && data.isPublished;
  const hasLoaneeFooter = isLoanee && data.isPublished;
  const hasFooter = hasConsultantFooter || hasLoaneeFooter;
  const userInitials = getInitials(wsCtx.firstName, wsCtx.lastName);
  const canAssign = isLoanee && can("loanee", wsCtx.role, "deliverable:assign");
  const allApproved = totalCount > 0 && approvedCount === totalCount;

  const ifcFull = IFC_CATEGORIES[data.ifcCategory];
  const ifcChip = IFC_CHIP_LABEL[data.ifcCategory];

  return (
    <div style={{ margin: "-24px" }}>
      <div className="action-detail">
        {/* ── Main column ─────────────────────────────────────────────────── */}
        <div
          style={{
            padding: "32px 40px",
            paddingBottom: hasFooter ? 88 : 48,
            maxWidth: 820,
            minWidth: 0,
          }}
        >
          {/* Returned callout — loanee only */}
          {isLoanee && sentBackCount > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 14px",
                borderRadius: "var(--radius-lg)",
                fontSize: 13,
                lineHeight: 1.5,
                marginBottom: 20,
                border: "1px solid #E8D0A8",
                background: "var(--status-returned-bg)",
                color: "var(--status-returned-fg)",
              }}
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }}
              >
                <path d="M8 1l7 13H1L8 1z" />
                <path d="M8 6v4M8 12v.01" strokeWidth="1.8" />
              </svg>
              <div>
                <strong style={{ fontWeight: 600 }}>
                  Returned for revision.
                </strong>{" "}
                {sentBackCount === 1
                  ? "One deliverable needs updated evidence."
                  : `${sentBackCount} deliverables need updated evidence.`}
                {approvedCount > 0 && (
                  <>
                    {" "}
                    {approvedCount === 1
                      ? "One deliverable has been approved and is locked."
                      : `${approvedCount} deliverables have been approved and are locked.`}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Title row */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 13,
                color: "var(--fg-tertiary)",
                paddingTop: 6,
                flexShrink: 0,
              }}
            >
              {data.actionNumber}
            </span>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.015em",
                lineHeight: 1.3,
                flex: 1,
                margin: 0,
                color: "var(--fg)",
              }}
            >
              {data.title}
            </h1>
            {isConsultant && (
              <div style={{ flexShrink: 0, paddingTop: 4 }}>
                <EditActionModal
                  actionId={data.id}
                  projectId={data.projectId}
                  projectName={data.projectName}
                  loaneeName={data.loaneeName}
                  variant="detail"
                  disabled={allApproved}
                />
              </div>
            )}
          </div>

          {/* Status row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 28,
              flexWrap: "wrap",
            }}
          >
            <StatusChipEl status={displayStatus} />
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "3px 8px",
                borderRadius: 99,
                fontSize: 11.5,
                fontWeight: 500,
                background: "var(--ifc-bg)",
                color: "var(--ifc-fg)",
              }}
            >
              {ifcChip}
            </span>
            {isLoanee && (
              <AssigneeChip
                actionId={data.id}
                projectId={data.projectId}
                assignedTo={data.assignedTo}
                members={loaneeMembers}
                canAssign={canAssign}
                departmentHint={data.departmentHint}
              />
            )}
          </div>

          {/* Recommendation */}
          {data.description && (
            <div style={{ marginBottom: 28 }}>
              <SectionLabel>Recommendation</SectionLabel>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: "var(--fg)",
                }}
              >
                {data.description.split("\n").map((para, i) => (
                  <p key={i} style={{ margin: i < data.description!.split("\n").length - 1 ? "0 0 10px 0" : "0" }}>
                    {para}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Deliverables */}
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>
              Deliverables
              {totalCount > 0 && (
                <span style={{ textTransform: "none", fontWeight: 400 }}>
                  {" "}
                  · {approvedCount} of {totalCount} approved
                  {sentBackCount > 0 &&
                    isConsultant &&
                    ` · ${totalCount - approvedCount} awaiting your review`}
                </span>
              )}
            </SectionLabel>
            {totalCount === 0 ? (
              <p style={{ fontSize: 13, color: "var(--fg-tertiary)" }}>
                No deliverables yet.
              </p>
            ) : (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {data.deliverables.map((d) => (
                  <DeliverableCard
                    key={d.id}
                    deliverable={d}
                    workspaceType={wsCtx.workspaceType}
                    role={wsCtx.role}
                    currentUserId={wsCtx.userId}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Comments */}
          <div style={{ marginBottom: 28 }}>
            <SectionLabel>
              Conversation
              {data.comments.filter((c) => !c.deletedAt).length > 0 && (
                <span style={{ textTransform: "none", fontWeight: 400 }}>
                  {" "}
                  · {data.comments.filter((c) => !c.deletedAt).length}
                </span>
              )}
            </SectionLabel>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              {data.comments.length === 0 && (
                <p
                  style={{
                    fontSize: 13,
                    color: "var(--fg-tertiary)",
                    margin: "0 0 4px 0",
                  }}
                >
                  No comments yet.
                </p>
              )}
              {data.comments.map((c) => (
                <CommentItem
                  key={c.id}
                  id={c.id}
                  body={c.body}
                  createdAt={c.createdAt.toISOString()}
                  editedAt={c.editedAt?.toISOString() ?? null}
                  isDeleted={c.deletedAt !== null}
                  authorId={c.authorId}
                  authorName={c.authorName}
                  workspaceType={c.workspaceType}
                  workspaceName={c.workspaceName}
                  currentUserId={wsCtx.userId}
                />
              ))}
            </div>
            <CommentComposer
              actionId={data.id}
              workspaceType={wsCtx.workspaceType}
              initials={userInitials}
            />
          </div>
        </div>

        {/* ── Right sidebar ───────────────────────────────────────────────── */}
        <aside className="action-sidebar">
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Details</SectionLabel>
            <div
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <MetaRow label="Status">
                <StatusChipEl status={displayStatus} />
              </MetaRow>
              <MetaRow label="IFC Standard">{ifcFull}</MetaRow>
              {isLoanee && data.departmentHint && (
                <MetaRow label="Suggested team">
                  <span style={{ color: "var(--fg-secondary)" }}>
                    {data.departmentHint}
                    <span style={{ color: "var(--fg-tertiary)" }}> · hint from consultant</span>
                  </span>
                </MetaRow>
              )}
              {isLoanee && (
                <MetaRow label="Assignee">
                  <AssigneeChip
                    actionId={data.id}
                    projectId={data.projectId}
                    assignedTo={data.assignedTo}
                    members={loaneeMembers}
                    canAssign={canAssign}
                    departmentHint={data.departmentHint}
                  />
                </MetaRow>
              )}
              <MetaRow label="Action">
                <span
                  style={{
                    fontFamily: "ui-monospace, monospace",
                    fontSize: 12.5,
                  }}
                >
                  {data.actionNumber}
                </span>
              </MetaRow>
              <MetaRow label="Project">
                <Link
                  href={`/projects/${data.projectId}`}
                  className="action-project-link"
                >
                  {data.projectName}
                </Link>
              </MetaRow>
              <MetaRow label="Estimated cost">
                <EstimatedCostField
                  actionId={data.id}
                  projectId={data.projectId}
                  initialCost={data.estimatedCost}
                  canEdit={isConsultant}
                />
              </MetaRow>
            </div>
          </div>

          <hr
            style={{
              border: "none",
              borderTop: "1px solid var(--border)",
              margin: "0 0 20px 0",
            }}
          />

          <div>
            <SectionLabel>Activity</SectionLabel>
            {data.activityEntries.length === 0 ? (
              <p
                style={{
                  fontSize: 12.5,
                  color: "var(--fg-tertiary)",
                  margin: 0,
                  fontStyle: "italic",
                }}
              >
                No activity yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.activityEntries.map((entry) => {
                  const actorName =
                    entry.actorFirstName ?? entry.actorLastName ?? "Someone";
                  return (
                    <div
                      key={entry.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: "var(--fg-secondary)", lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 500, color: "var(--fg)" }}>{actorName}</span>
                        {" "}
                        {getActivityLabel(entry.eventType)}
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          color: "var(--fg-tertiary)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* ── Loanee submit bar ─────────────────────────────────────────────── */}
      {hasLoaneeFooter && (
        <SubmitActionBar
          actionId={data.id}
          projectId={data.projectId}
          deliverables={data.deliverables.map((d) => ({
            id: d.id,
            status: d.status,
            hasDoc: d.doc !== null,
          }))}
        />
      )}

      {/* ── Consultant footer ─────────────────────────────────────────────── */}
      {hasConsultantFooter && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 240,
            right: 320,
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--border)",
            padding: "14px 40px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            zIndex: 5,
            boxShadow: "0 -2px 8px rgba(0,0,0,0.02)",
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: "var(--fg-secondary)",
              marginRight: "auto",
            }}
          >
            <strong style={{ color: "var(--fg)", fontWeight: 600 }}>
              {approvedCount} of {totalCount}
            </strong>{" "}
            deliverables approved
            {!allApproved && (
              <span
                style={{ color: "var(--fg-tertiary)", fontWeight: 400 }}
              >
                {" "}
                · Approve all deliverables to close this Action
              </span>
            )}
          </div>
          <button
            disabled={!allApproved}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 16px",
              fontSize: 13.5,
              fontWeight: 500,
              fontFamily: "inherit",
              background: allApproved ? "var(--fg)" : "var(--bg-subtle)",
              color: allApproved ? "white" : "var(--fg-tertiary)",
              border: "none",
              borderRadius: "var(--radius)",
              cursor: allApproved ? "pointer" : "not-allowed",
              transition: "background 80ms",
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M3 8l3.5 3.5L13 5" />
            </svg>
            Approve Action
          </button>
        </div>
      )}
    </div>
  );
}

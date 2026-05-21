"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { IfcCategory } from "@/lib/db/schema";
import { EditActionModal } from "@/components/actions/edit-action-modal";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SerializedActionRow = {
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
  targetDate: string | null;
  departmentHint: string | null;
  assigneeFirstName: string | null;
  assigneeLastName: string | null;
};

type DisplayStatus = "progress" | "submitted" | "approved" | "returned";

type BoardColumnKey = "progress" | "submitted" | "returned" | "approved";

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

const IFC_FULL_LABEL: Record<IfcCategory, string> = {
  regulatory: "Regulatory Compliance",
  c1: "General Compliance",
  ps1: "PS1 · Assessment and Management of Environmental and Social Risks and Impacts",
  ps2: "PS2 · Labor and Working Conditions",
  ps3: "PS3 · Resource Efficiency and Pollution Prevention",
  ps4: "PS4 · Community Health, Safety, and Security",
  ps5: "PS5 · Land Acquisition and Involuntary Resettlement",
  ps6: "PS6 · Biodiversity Conservation and Sustainable Management of Living Natural Resources",
  ps7: "PS7 · Indigenous Peoples",
  ps8: "PS8 · Cultural Heritage",
};

const BOARD_COLUMNS: {
  key: BoardColumnKey;
  label: string;
  dotColor: string;
  statuses: DisplayStatus[];
  attention?: boolean;
}[] = [
  {
    key: "progress",
    label: "In Progress",
    dotColor: "var(--status-progress-fg)",
    statuses: ["progress"],
  },
  {
    key: "submitted",
    label: "Submitted",
    dotColor: "var(--status-submitted-fg)",
    statuses: ["submitted"],
  },
  {
    key: "returned",
    label: "Returned",
    dotColor: "var(--status-returned-fg)",
    statuses: ["returned"],
    attention: true,
  },
  {
    key: "approved",
    label: "Approved",
    dotColor: "var(--status-approved-fg)",
    statuses: ["approved"],
  },
];

const STATUS_CONFIG: Record<
  DisplayStatus,
  { label: string; bg: string; fg: string }
> = {
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

const STATUS_DISPLAY_OPTIONS: { value: DisplayStatus | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "progress", label: "In Progress" },
  { value: "submitted", label: "Submitted" },
  { value: "returned", label: "Returned" },
  { value: "approved", label: "Approved" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDisplayStatus(row: SerializedActionRow): DisplayStatus {
  if (row.sentBack > 0) return "returned";
  if (row.total > 0 && row.approved === row.total) return "approved";
  if (row.submitted > 0) return "submitted";
  return "progress";
}

function getDotsData(
  row: SerializedActionRow
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

function formatTargetDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const opts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { month: "short", day: "numeric" }
      : { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusChip({ row }: { row: SerializedActionRow }): JSX.Element {
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

function DeliverableProgress({ row }: { row: SerializedActionRow }): JSX.Element {
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

function DeliverableDots({ row }: { row: SerializedActionRow }): JSX.Element {
  if (row.total === 0) {
    return (
      <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
        No deliverables
      </span>
    );
  }
  const dots: { color: string; border: string }[] = [];
  for (let i = 0; i < row.approved; i++)
    dots.push({
      color: "var(--status-approved-fg)",
      border: "var(--status-approved-fg)",
    });
  for (let i = 0; i < row.submitted; i++)
    dots.push({
      color: "var(--status-submitted-fg)",
      border: "var(--status-submitted-fg)",
    });
  for (let i = 0; i < row.sentBack; i++)
    dots.push({
      color: "var(--status-returned-fg)",
      border: "var(--status-returned-fg)",
    });
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

function BoardCard({
  row,
  projectId,
}: {
  row: SerializedActionRow;
  projectId: string;
}): JSX.Element {
  const status = getDisplayStatus(row);
  const isReturned = status === "returned";
  const isApproved = status === "approved";
  const hasAssignee =
    row.assigneeFirstName !== null || row.assigneeLastName !== null;
  const assigneeInitials = (
    (row.assigneeFirstName?.[0] ?? "") + (row.assigneeLastName?.[0] ?? "")
  )
    .toUpperCase()
    .trim() || "?";

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
  actionRows: SerializedActionRow[];
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
        const colActions = actionRows.filter((a) =>
          (col.statuses as string[]).includes(getDisplayStatus(a))
        );
        const colBg = col.attention ? "#FBF1E599" : "var(--bg-subtle)";
        const colBorder = col.attention ? "1px solid #E8D0A870" : "none";
        const headerBg = col.attention ? "#FBF1E5" : "var(--bg-subtle)";
        const headerBorderBottom = col.attention
          ? "1px solid #E8D0A8"
          : "1px solid var(--border)";
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
                style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg)" }}
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

function ActionTableRow({
  row,
  projectId,
  isConsultant,
  projectName,
  loaneeName,
}: {
  row: SerializedActionRow;
  projectId: string;
  isConsultant: boolean;
  projectName: string;
  loaneeName: string;
}): JSX.Element {
  return (
    <tr
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
      <td style={{ padding: "10px 16px", verticalAlign: "top", width: 130 }}>
        <StatusChip row={row} />
      </td>
      <td
        style={{ padding: "10px 16px", verticalAlign: "top", maxWidth: 260 }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
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

function ActionsTable({
  actionRows,
  projectId,
  isConsultant,
  projectName,
  loaneeName,
}: {
  actionRows: SerializedActionRow[];
  projectId: string;
  isConsultant: boolean;
  projectName: string;
  loaneeName: string;
}): JSX.Element {
  const grouped = new Map<IfcCategory, SerializedActionRow[]>();
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
          No matching actions
        </p>
        <p style={{ fontSize: 12, margin: 0 }}>
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
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
                    {IFC_FULL_LABEL[cat]}
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

// ─── Toolbar ──────────────────────────────────────────────────────────────────

const SELECT_STYLE: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "5px 28px 5px 10px",
  background: "var(--bg-surface)",
  fontSize: 12.5,
  color: "var(--fg-secondary)",
  fontFamily: "inherit",
  cursor: "pointer",
  outline: "none",
};

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}): JSX.Element {
  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          ...SELECT_STYLE,
          fontWeight: value !== "" ? 500 : undefined,
          color: value !== "" ? "var(--fg)" : undefined,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <svg
        width="11"
        height="11"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        style={{
          position: "absolute",
          right: 8,
          pointerEvents: "none",
          color: "var(--fg-tertiary)",
        }}
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function ProjectViewClient({
  actionRows,
  projectId,
  view,
  isConsultant,
  projectName,
  loaneeName,
}: {
  actionRows: SerializedActionRow[];
  projectId: string;
  view: "board" | "table";
  isConsultant: boolean;
  projectName: string;
  loaneeName: string;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const [ifcCategory, setIfcCategory] = useState<IfcCategory | "">("");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "">("");

  const filtered = actionRows.filter((row) => {
    if (search) {
      const q = search.toLowerCase();
      const matchTitle = row.title.toLowerCase().includes(q);
      const matchDesc = row.description?.toLowerCase().includes(q) ?? false;
      if (!matchTitle && !matchDesc) return false;
    }
    if (ifcCategory && row.ifcCategory !== ifcCategory) return false;
    if (statusFilter && getDisplayStatus(row) !== statusFilter) return false;
    return true;
  });

  if (actionRows.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 24px",
          color: "var(--fg-tertiary)",
          gap: 10,
          textAlign: "center",
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          style={{ opacity: 0.35 }}
        >
          <rect x="2" y="2" width="12" height="12" rx="1" />
          <path d="M5 8h6M5 5h6M5 11h3" />
        </svg>
        <p style={{ fontSize: 13.5, fontWeight: 500, color: "var(--fg-secondary)", margin: 0 }}>
          No actions yet
        </p>
        <p style={{ fontSize: 12.5, margin: 0 }}>
          The action plan hasn&apos;t been published yet.
        </p>
      </div>
    );
  }

  const ifcOptionsDisplay: { value: string; label: string }[] = [
    { value: "", label: "All categories" },
    { value: "regulatory", label: "Regulatory Compliance" },
    { value: "c1", label: "C1 · General Compliance" },
    { value: "ps1", label: "PS1 · Assessment & Management" },
    { value: "ps2", label: "PS2 · Labor & Working Conditions" },
    { value: "ps3", label: "PS3 · Resource Efficiency" },
    { value: "ps4", label: "PS4 · Community Health & Safety" },
    { value: "ps5", label: "PS5 · Land Acquisition" },
    { value: "ps6", label: "PS6 · Biodiversity Conservation" },
    { value: "ps7", label: "PS7 · Indigenous Peoples" },
    { value: "ps8", label: "PS8 · Cultural Heritage" },
  ];

  const VIEWS = [
    {
      key: "board" as const,
      label: "Board",
      icon: (
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ width: 13, height: 13 }}
        >
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
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ width: 13, height: 13 }}
        >
          <path d="M2 4h12M2 8h12M2 12h12" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 32px",
          borderBottom: "1px solid var(--border)",
          flexWrap: "wrap",
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
              className={
                view === key ? "view-switcher-btn active" : "view-switcher-btn"
              }
              style={{ textDecoration: "none" }}
            >
              {icon}
              {label}
            </Link>
          ))}
        </div>

        {/* IFC Category filter */}
        <FilterSelect
          value={ifcCategory}
          onChange={(v) => setIfcCategory(v as IfcCategory | "")}
          options={ifcOptionsDisplay}
        />

        {/* Status filter */}
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as DisplayStatus | "")}
          options={STATUS_DISPLAY_OPTIONS}
        />

        {/* Search */}
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
            <svg
              width="13"
              height="13"
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

      {/* View */}
      {view === "board" ? (
        <ActionsBoard actionRows={filtered} projectId={projectId} />
      ) : (
        <ActionsTable
          actionRows={filtered}
          projectId={projectId}
          isConsultant={isConsultant}
          projectName={projectName}
          loaneeName={loaneeName}
        />
      )}
    </>
  );
}

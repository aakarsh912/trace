"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import type { WorkspaceType } from "@/lib/db/schema";

export type ProjectWithStats = {
  id: string;
  name: string;
  isPublished: boolean;
  bankName: string;
  consultantName: string;
  loaneeName: string;
  totalDeliverables: number;
  approvedCount: number;
  submittedCount: number;
  pendingCount: number;
  sentBackCount: number;
};

type StatusFilter = "all" | "active" | "draft" | "completed";

const STATUS_LABELS: Record<StatusFilter, string> = {
  all: "All",
  active: "Active",
  draft: "Draft",
  completed: "Completed",
};

const STATUS_ORDER: StatusFilter[] = ["all", "active", "draft", "completed"];

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

function getProjectStatus(p: ProjectWithStats): "active" | "draft" | "completed" {
  if (!p.isPublished) return "draft";
  if (p.totalDeliverables > 0 && p.approvedCount === p.totalDeliverables) return "completed";
  return "active";
}

function MiniProgressBar({ project }: { project: ProjectWithStats }): JSX.Element {
  const total = project.totalDeliverables;
  if (total === 0) {
    return (
      <div
        style={{ width: 80, height: 4, background: "var(--border)", borderRadius: 2 }}
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

export function ProjectsClient({
  projects,
  workspaceType,
}: {
  projects: ProjectWithStats[];
  workspaceType: WorkspaceType;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = projects.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (status !== "all" && getProjectStatus(p) !== status) return false;
    return true;
  });

  const placeholder =
    workspaceType === "bank"
      ? "Search loanees, projects, consultants…"
      : "Search projects…";

  const countLabel =
    filtered.length === 1 ? "1 project" : `${filtered.length} projects`;

  function cycleStatus(): void {
    const idx = STATUS_ORDER.indexOf(status);
    setStatus(STATUS_ORDER[(idx + 1) % STATUS_ORDER.length]!);
  }

  return (
    <>
      {/* Filter row */}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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

        <button
          className="filter-chip-btn"
          onClick={cycleStatus}
          style={
            status !== "all"
              ? { background: "var(--fg)", color: "white", borderColor: "var(--fg)" }
              : undefined
          }
        >
          Status: {STATUS_LABELS[status]}
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

      {/* Project list */}
      {filtered.length === 0 ? (
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
          <p
            style={{
              fontSize: 13,
              margin: 0,
              fontWeight: 500,
              color: "var(--fg-secondary)",
            }}
          >
            {projects.length === 0 ? "No projects yet" : "No matching projects"}
          </p>
          <p style={{ fontSize: 12, margin: 0 }}>
            {projects.length === 0
              ? workspaceType === "consultant"
                ? "Create your first project to get started."
                : "Projects will appear here once you're added to one."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              workspaceType={workspaceType}
            />
          ))}
        </div>
      )}
    </>
  );
}

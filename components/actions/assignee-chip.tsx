"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export type AssigneeMember = {
  id: string;
  firstName: string | null;
  lastName: string | null;
};

type Props = {
  actionId: string;
  projectId: string;
  assignedTo: AssigneeMember | null;
  members: AssigneeMember[];
  canAssign: boolean;
  departmentHint?: string | null;
};

function getInitials(m: AssigneeMember): string {
  return ((m.firstName?.[0] ?? "") + (m.lastName?.[0] ?? "")).toUpperCase() || "?";
}

function getFullName(m: AssigneeMember): string {
  return [m.firstName, m.lastName].filter(Boolean).join(" ") || "Unknown";
}

export function AssigneeChip({
  actionId,
  projectId,
  assignedTo,
  members,
  canAssign,
  departmentHint,
}: Props): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<AssigneeMember | null>(assignedTo);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Sync both chips when the server re-renders after router.refresh()
  useEffect(() => {
    setCurrent(assignedTo);
  }, [assignedTo]);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function assign(userId: string | null): Promise<void> {
    setOpen(false);
    setSearch("");
    setSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/actions/${actionId}/assign`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedToId: userId }),
        }
      );
      if (res.ok) {
        // Optimistic update for this chip
        setCurrent(userId ? (members.find((m) => m.id === userId) ?? null) : null);
        // Refresh server data so the other chip syncs via the useEffect above
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  const filtered = search
    ? members.filter((m) =>
        getFullName(m).toLowerCase().includes(search.toLowerCase())
      )
    : members;

  const chip = current ? (
    <button
      type="button"
      disabled={!canAssign || saving}
      onClick={canAssign ? () => setOpen((o) => !o) : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px 3px 4px",
        fontSize: 12,
        color: "var(--fg)",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: 999,
        cursor: canAssign ? "pointer" : "default",
        fontFamily: "inherit",
        transition: "background 60ms, border-color 60ms",
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          fontSize: 9,
          flexShrink: 0,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          color: "white",
          background: "#5B7FA3",
        }}
      >
        {getInitials(current)}
      </span>
      <span>{getFullName(current)}</span>
    </button>
  ) : (
    <button
      type="button"
      disabled={!canAssign || saving}
      onClick={canAssign ? () => setOpen((o) => !o) : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        fontSize: 12,
        color: "var(--fg-tertiary)",
        background: "transparent",
        border: "1px dashed var(--border-strong, #ccc)",
        borderRadius: 999,
        cursor: canAssign ? "pointer" : "default",
        fontFamily: "inherit",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="6" r="3" />
        <path d="M2 14c1-3 4-4 6-4s5 1 6 4" />
      </svg>
      {canAssign ? "Assign" : "Unassigned"}
    </button>
  );

  if (!canAssign) return chip;

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-flex" }}>
      {chip}

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 200,
            minWidth: 280,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            style={{
              padding: "10px 12px 6px",
              borderBottom: "1px solid var(--border)",
              background: "var(--bg)",
            }}
          >
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Assign to…"
              style={{
                width: "100%",
                border: "none",
                background: "transparent",
                padding: "4px 0",
                fontSize: 13,
                color: "var(--fg)",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Hint */}
          {departmentHint && (
            <div
              style={{
                fontSize: 11,
                color: "var(--fg-tertiary)",
                padding: "4px 12px 6px",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg)",
              }}
            >
              Suggested team:{" "}
              <strong style={{ fontWeight: 500, color: "var(--fg-secondary)" }}>
                {departmentHint}
              </strong>
            </div>
          )}

          {/* Member list */}
          <div style={{ padding: 4, maxHeight: 280, overflowY: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--fg-tertiary)", padding: "8px 10px" }}>
                No members found
              </div>
            ) : (
              filtered.map((m) => (
                <PickerItem
                  key={m.id}
                  member={m}
                  isSelected={current?.id === m.id}
                  onSelect={() => void assign(m.id)}
                />
              ))
            )}
          </div>

          {/* Unassign */}
          <div style={{ height: 1, background: "var(--border)", margin: "4px 0" }} />
          <UnassignButton onUnassign={() => void assign(null)} />
        </div>
      )}
    </div>
  );
}

function PickerItem({
  member,
  isSelected,
  onSelect,
}: {
  member: AssigneeMember;
  isSelected: boolean;
  onSelect: () => void;
}): JSX.Element {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 9px",
        borderRadius: "var(--radius-sm, 4px)",
        cursor: "pointer",
        fontSize: 13,
        width: "100%",
        border: "none",
        background: hover ? "var(--bg-hover)" : isSelected ? "var(--bg-subtle)" : "transparent",
        fontFamily: "inherit",
        textAlign: "left",
        transition: "background 60ms",
      }}
    >
      <span
        style={{
          width: 24,
          height: 24,
          flexShrink: 0,
          borderRadius: "50%",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 600,
          fontSize: 10.5,
          color: "white",
          background: "#5B7FA3",
        }}
      >
        {getInitials(member)}
      </span>
      <span style={{ flex: 1, color: "var(--fg)" }}>{getFullName(member)}</span>
      {isSelected && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 8l3.5 3.5L13 5" />
        </svg>
      )}
    </button>
  );
}

function UnassignButton({ onUnassign }: { onUnassign: () => void }): JSX.Element {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onUnassign}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "6px 9px",
        borderRadius: "var(--radius-sm, 4px)",
        cursor: "pointer",
        fontSize: 12.5,
        width: "100%",
        border: "none",
        background: "transparent",
        fontFamily: "inherit",
        color: hover ? "#9B2F2F" : "var(--fg-secondary)",
        transition: "color 60ms, background 60ms",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="6" />
        <path d="M5 5l6 6M11 5l-6 6" />
      </svg>
      Unassign
    </button>
  );
}

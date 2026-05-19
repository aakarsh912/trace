"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceType } from "@/lib/db/schema";

const AVATAR_BG: Record<WorkspaceType, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

function formatTime(iso: string): string {
  const date = new Date(iso);
  const d = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  const t = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).format(date);
  return `${d} · ${t}`;
}

type Props = {
  id: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  isDeleted: boolean;
  authorId: string | null;
  authorName: string;
  workspaceType: WorkspaceType | null;
  workspaceName: string | null;
  currentUserId: string;
};

export function CommentItem({
  id,
  body,
  createdAt,
  editedAt,
  isDeleted,
  authorId,
  authorName,
  workspaceType,
  workspaceName,
  currentUserId,
}: Props): JSX.Element {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(body);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isOwn = authorId === currentUserId;
  const avatarBg = workspaceType ? AVATAR_BG[workspaceType] : "#999";
  const initials = authorName
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleSave(): Promise<void> {
    if (!editBody.trim() || saving) return;
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: editBody }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setEditError(data.error ?? "Failed to save");
      } else {
        setEditing(false);
        router.refresh();
      }
    } catch {
      setEditError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/comments/${id}`, { method: "DELETE" });
      router.refresh();
    } catch {
      setDeleting(false);
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") void handleSave();
    if (e.key === "Escape") { setEditing(false); setEditBody(body); }
  }

  if (isDeleted) {
    return (
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "var(--border)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 13,
            color: "var(--fg-tertiary)",
            fontStyle: "italic",
          }}
        >
          Comment deleted
        </span>
      </div>
    );
  }

  return (
    <div
      className="comment-row"
      style={{ display: "flex", gap: 10, alignItems: "flex-start", position: "relative" }}
    >
      {isOwn && !editing && (
        <div className="comment-actions-group" style={{ position: "absolute", top: 0, right: 0, display: "flex", gap: 2 }}>
          <button
            className="comment-action-btn"
            title="Edit"
            onClick={() => { setEditBody(body); setEditing(true); }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M11 2l3 3-8 8H3v-3l8-8z" />
            </svg>
          </button>
          <button
            className="comment-action-btn danger"
            title="Delete"
            onClick={() => void handleDelete()}
            disabled={deleting}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M2 4h12M5 4V2h6v2M6 7v5M10 7v5M3 4l1 10h8l1-10" />
            </svg>
          </button>
        </div>
      )}

      <div
        style={{
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: avatarBg,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 600,
          flexShrink: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {initials}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            marginBottom: 4,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontWeight: 500, fontSize: 13, color: "var(--fg)" }}>
            {isOwn ? "You" : authorName}
          </span>
          {workspaceName && (
            <span
              style={{
                fontSize: 11,
                color: "var(--fg-tertiary)",
                padding: "1px 6px",
                background: "var(--bg-subtle)",
                borderRadius: 3,
              }}
            >
              {workspaceName}
            </span>
          )}
          <span style={{ fontSize: "11.5px", color: "var(--fg-tertiary)" }}>
            {formatTime(createdAt)}
          </span>
          {editedAt && (
            <span style={{ fontSize: "11.5px", color: "var(--fg-tertiary)" }}>
              (edited)
            </span>
          )}
        </div>

        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={3}
              className="comment-compose-input"
              disabled={saving}
              autoFocus
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => { setEditing(false); setEditBody(body); setEditError(null); }}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  color: "var(--fg-secondary)",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={saving || !editBody.trim()}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  fontFamily: "inherit",
                  cursor: saving || !editBody.trim() ? "not-allowed" : "pointer",
                  background: "var(--fg)",
                  color: "white",
                  border: "none",
                  borderRadius: "var(--radius)",
                  opacity: saving || !editBody.trim() ? 0.5 : 1,
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
            {editError && (
              <span style={{ fontSize: 12, color: "var(--status-attention-fg)" }}>
                {editError}
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: "13.5px", lineHeight: 1.55, color: "var(--fg)" }}>
            {body}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceType } from "@/lib/db/schema";

type CommentComposerProps = {
  actionId: string;
  workspaceType: WorkspaceType;
  initials: string;
};

const AVATAR_BG: Record<WorkspaceType, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

export function CommentComposer({
  actionId,
  workspaceType,
  initials,
}: CommentComposerProps): JSX.Element {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePost(): Promise<void> {
    if (!body.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, body }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong");
      } else {
        setBody("");
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      void handlePost();
    }
  }

  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: AVATAR_BG[workspaceType],
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          flexShrink: 0,
          letterSpacing: "-0.01em",
        }}
      >
        {initials}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a comment…"
          rows={2}
          className="comment-compose-input"
          disabled={loading}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "11.5px", color: "var(--fg-tertiary)" }}>
            Visible to all parties · ⌘↵ to post
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setBody("")}
              disabled={loading || !body}
              style={{
                padding: "5px 10px",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor: !body ? "not-allowed" : "pointer",
                background: "transparent",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                color: "var(--fg-secondary)",
                opacity: !body ? 0.5 : 1,
              }}
            >
              Clear
            </button>
            <button
              onClick={() => void handlePost()}
              disabled={loading || !body.trim()}
              style={{
                padding: "5px 14px",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor: loading || !body.trim() ? "not-allowed" : "pointer",
                background: "var(--fg)",
                color: "white",
                border: "none",
                borderRadius: "var(--radius)",
                opacity: loading || !body.trim() ? 0.5 : 1,
                transition: "opacity 80ms",
              }}
            >
              {loading ? "Posting…" : "Post comment"}
            </button>
          </div>
        </div>
        {error && (
          <span style={{ fontSize: 12, color: "var(--status-attention-fg)" }}>
            {error}
          </span>
        )}
      </div>
    </div>
  );
}

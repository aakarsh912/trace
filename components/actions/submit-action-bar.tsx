"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type DeliverableSummary = {
  id: string;
  status: string;
  hasDoc: boolean;
};

type Props = {
  actionId: string;
  projectId: string;
  deliverables: DeliverableSummary[];
};

export function SubmitActionBar({ actionId, projectId, deliverables }: Props): JSX.Element | null {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pendingWithDoc = deliverables.filter(
    (d) => d.status === "pending" && d.hasDoc
  );
  const canSubmit = pendingWithDoc.length > 0;

  const submittedCount = deliverables.filter((d) => d.status === "submitted").length;
  const approvedCount = deliverables.filter((d) => d.status === "approved").length;
  const totalCount = deliverables.length;

  async function handleSubmit(): Promise<void> {
    if (!canSubmit || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/actions/${actionId}/submit-all`,
        { method: "POST" }
      );
      if (res.ok) {
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to submit");
      }
    } catch {
      setError("Network error — please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 240,
        right: 0,
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
      <div style={{ fontSize: 13, color: "var(--fg-secondary)", marginRight: "auto" }}>
        {error ? (
          <span style={{ color: "var(--status-attention-fg)" }}>{error}</span>
        ) : canSubmit ? (
          <>
            <strong style={{ color: "var(--fg)" }}>{pendingWithDoc.length}</strong>
            {" deliverable"}{pendingWithDoc.length !== 1 ? "s" : ""} ready to submit
            {approvedCount > 0 && (
              <span style={{ color: "var(--fg-tertiary)" }}>
                {" "}· {approvedCount} of {totalCount} approved
              </span>
            )}
          </>
        ) : submittedCount > 0 ? (
          <>
            <strong style={{ color: "var(--fg)" }}>{submittedCount}</strong>
            {" deliverable"}{submittedCount !== 1 ? "s" : ""} in review
            {approvedCount > 0 && (
              <span style={{ color: "var(--fg-tertiary)" }}>
                {" "}· {approvedCount} approved
              </span>
            )}
          </>
        ) : (
          <span style={{ color: "var(--fg-tertiary)" }}>
            Upload evidence to each deliverable, then submit for review.
          </span>
        )}
      </div>

      <button
        onClick={() => void handleSubmit()}
        disabled={!canSubmit || loading}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 16px",
          fontSize: 13.5,
          fontWeight: 500,
          fontFamily: "inherit",
          background: canSubmit && !loading ? "var(--fg)" : "var(--bg-subtle)",
          color: canSubmit && !loading ? "white" : "var(--fg-tertiary)",
          border: "none",
          borderRadius: "var(--radius)",
          cursor: canSubmit && !loading ? "pointer" : "not-allowed",
          transition: "background 80ms",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 3v8M4 7l4-4 4 4" />
          <path d="M3 13h10" />
        </svg>
        {loading ? "Submitting…" : "Submit all for review"}
      </button>
    </div>
  );
}

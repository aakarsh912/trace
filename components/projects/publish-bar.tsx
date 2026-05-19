"use client";

import { useState } from "react";

type CategoryCount = {
  label: string;
  draftCount: number;
};

type Props = {
  projectId: string;
  loaneeName: string;
  isPublished: boolean;
  draftCount: number;
  publishedCount: number;
  categoryCounts: CategoryCount[];
};

export function PublishBar({
  projectId,
  loaneeName,
  isPublished,
  draftCount,
  publishedCount,
  categoryCounts,
}: Props): JSX.Element {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftCategories = categoryCounts.filter((c) => c.draftCount > 0);

  async function handlePublish(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Failed to publish");
        setLoading(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  const allPublished = draftCount === 0 && publishedCount > 0;
  const nothingYet = draftCount === 0 && publishedCount === 0;

  return (
    <>
      {/* Publish bar */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 240,
          right: 0,
          background: "var(--bg-surface)",
          borderTop: "1px solid var(--border)",
          padding: "12px 32px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          zIndex: 10,
        }}
      >
        {/* Summary */}
        <span style={{ fontSize: 12.5, color: "var(--fg-secondary)" }}>
          {allPublished ? (
            <>
              <span style={{ color: "var(--status-approved-fg)", fontWeight: 500 }}>
                {publishedCount} Published
              </span>
              {" · "}
              <span style={{ color: "var(--fg-tertiary)" }}>No drafts</span>
            </>
          ) : nothingYet ? (
            <span style={{ color: "var(--fg-tertiary)" }}>No actions yet</span>
          ) : (
            <>
              {publishedCount > 0 && (
                <>
                  <span style={{ color: "var(--status-approved-fg)", fontWeight: 500 }}>
                    {publishedCount} Published
                  </span>
                  {" · "}
                </>
              )}
              <span style={{ color: "var(--status-draft-fg)", fontWeight: 500 }}>
                {draftCount} {draftCount === 1 ? "Draft" : "Drafts"}
              </span>
            </>
          )}
        </span>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {allPublished ? (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: "var(--radius)",
                background: "var(--status-approved-bg)",
                color: "var(--status-approved-fg)",
                fontSize: 12.5,
                fontWeight: 500,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8l4 4 6-7" />
              </svg>
              {isPublished ? "Action plan published" : "All actions published"}
            </span>
          ) : (
            <button
              onClick={() => setModalOpen(true)}
              disabled={nothingYet}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: "var(--radius)",
                background: nothingYet ? "var(--bg-subtle)" : "var(--fg)",
                color: nothingYet ? "var(--fg-tertiary)" : "var(--bg)",
                border: "none",
                cursor: nothingYet ? "not-allowed" : "pointer",
                fontSize: 12.5,
                fontWeight: 500,
                opacity: nothingYet ? 0.5 : 1,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M8 2v8M5 7l3 3 3-3" />
                <path d="M3 13h10" />
              </svg>
              {isPublished ? `Publish ${draftCount} new ${draftCount === 1 ? "draft" : "drafts"}` : "Publish action plan"}
            </button>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.28)",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-surface)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
              padding: "24px",
              width: 400,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
            }}
          >
            <h3
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--fg)",
                margin: "0 0 4px",
              }}
            >
              Publish action plan
            </h3>
            <p
              style={{
                fontSize: 12.5,
                color: "var(--fg-secondary)",
                margin: "0 0 16px",
                lineHeight: 1.5,
              }}
            >
              {draftCount} {draftCount === 1 ? "action" : "actions"} will become visible to{" "}
              <strong>{loaneeName}</strong>.
            </p>

            {draftCategories.length > 0 && (
              <div
                style={{
                  background: "var(--bg-subtle)",
                  borderRadius: "var(--radius)",
                  padding: "10px 12px",
                  marginBottom: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                {draftCategories.map((c) => (
                  <div
                    key={c.label}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 12,
                      color: "var(--fg-secondary)",
                    }}
                  >
                    <span>{c.label}</span>
                    <span style={{ color: "var(--fg-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                      {c.draftCount} {c.draftCount === 1 ? "action" : "actions"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--status-attention-fg)",
                  background: "var(--status-attention-bg)",
                  border: "1px solid var(--status-attention-fg)",
                  borderRadius: "var(--radius)",
                  padding: "6px 10px",
                  margin: "0 0 12px",
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setModalOpen(false);
                  setError(null);
                }}
                disabled={loading}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius)",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--fg-secondary)",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={loading}
                style={{
                  padding: "6px 14px",
                  borderRadius: "var(--radius)",
                  border: "none",
                  background: "var(--fg)",
                  color: "var(--bg)",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {loading ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

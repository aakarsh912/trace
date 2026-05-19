"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ReviewControlsProps = {
  deliverableId: string;
};

export function ReviewControls({
  deliverableId,
}: ReviewControlsProps): JSX.Element {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "sending-back">("idle");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approved" }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmSendBack(): Promise<void> {
    if (!reason.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "sent_back", comment: reason }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong");
      } else {
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: mode === "idle" ? "center" : "flex-start",
        gap: 8,
        padding: "10px 16px",
        background: "var(--bg-subtle)",
        borderTop: "1px solid var(--border)",
        fontSize: 12.5,
      }}
    >
      <span
        style={{
          color: "var(--fg-tertiary)",
          marginRight: "auto",
          flexShrink: 0,
          paddingTop: mode === "sending-back" ? 2 : 0,
        }}
      >
        Your review:
      </span>

      {mode === "idle" ? (
        <>
          <button
            onClick={() => void handleApprove()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              fontSize: 12.5,
              fontFamily: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
              background: "var(--status-approved-bg)",
              color: "var(--status-approved-fg)",
              border: "1px solid #C8E0D2",
              borderRadius: "var(--radius)",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 80ms",
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
            Approve
          </button>
          <button
            onClick={() => setMode("sending-back")}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 12px",
              fontSize: 12.5,
              fontFamily: "inherit",
              cursor: loading ? "not-allowed" : "pointer",
              background: "var(--status-returned-bg)",
              color: "var(--status-returned-fg)",
              border: "1px solid #E8D0A8",
              borderRadius: "var(--radius)",
              opacity: loading ? 0.6 : 1,
              transition: "opacity 80ms",
            }}
          >
            Send back
          </button>
        </>
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for sending back…"
            rows={2}
            autoFocus
            disabled={loading}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "8px 10px",
              fontSize: 13,
              fontFamily: "inherit",
              resize: "vertical",
              color: "var(--fg)",
              background: "var(--bg-surface)",
              width: "100%",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor =
                "var(--fg-secondary)";
            }}
            onBlur={(e) => {
              (e.target as HTMLTextAreaElement).style.borderColor =
                "var(--border)";
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => {
                setMode("idle");
                setReason("");
                setError(null);
              }}
              disabled={loading}
              style={{
                padding: "5px 10px",
                fontSize: 12.5,
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
              onClick={() => void handleConfirmSendBack()}
              disabled={loading || !reason.trim()}
              style={{
                padding: "5px 12px",
                fontSize: 12.5,
                fontFamily: "inherit",
                cursor:
                  loading || !reason.trim() ? "not-allowed" : "pointer",
                background: "var(--status-returned-bg)",
                color: "var(--status-returned-fg)",
                border: "1px solid #E8D0A8",
                borderRadius: "var(--radius)",
                opacity: loading || !reason.trim() ? 0.6 : 1,
                transition: "opacity 80ms",
              }}
            >
              {loading ? "Sending…" : "Confirm send back"}
            </button>
          </div>
          {error && (
            <span
              style={{ fontSize: 12, color: "var(--status-attention-fg)" }}
            >
              {error}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

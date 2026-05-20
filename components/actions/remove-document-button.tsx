"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  deliverableId: string;
  uploadedById: string | null;
  currentUserId: string;
};

export function RemoveDocumentButton({
  deliverableId,
  uploadedById,
  currentUserId,
}: Props): JSX.Element | null {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Only show to the user who uploaded
  if (!uploadedById || uploadedById !== currentUserId) return null;

  async function handleRemove(): Promise<void> {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deliverables/${deliverableId}/document`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => void handleRemove()}
      disabled={loading}
      title="Remove file"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 22,
        height: 22,
        padding: 0,
        background: "transparent",
        border: "none",
        borderRadius: "var(--radius-sm, 4px)",
        color: "var(--fg-tertiary)",
        cursor: loading ? "default" : "pointer",
        flexShrink: 0,
        opacity: loading ? 0.5 : 1,
        transition: "color 60ms, background 60ms",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.color = "#9B2F2F";
        (e.currentTarget as HTMLElement).style.background = "var(--status-attention-bg)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.color = "var(--fg-tertiary)";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}

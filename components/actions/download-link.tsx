"use client";

import { useState } from "react";

type Props = {
  documentId: string;
  fileName: string;
};

export function DownloadLink({ documentId, fileName }: Props): JSX.Element {
  const [loading, setLoading] = useState(false);

  async function handleClick(): Promise<void> {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/download-url`);
      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) msg = data.error;
        } catch { /* empty */ }
        alert(msg);
        return;
      }
      const { url } = (await res.json()) as { url: string };
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("Could not open file. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={() => void handleClick()}
      disabled={loading}
      style={{
        flex: 1,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        color: loading ? "var(--fg-tertiary)" : "var(--fg)",
        background: "none",
        border: "none",
        padding: 0,
        cursor: loading ? "default" : "pointer",
        textAlign: "left",
        font: "inherit",
        fontSize: "inherit",
        textDecoration: "none",
      }}
      className="download-link"
    >
      {fileName}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  currentName: string;
  isAdmin: boolean;
};

export function WorkspaceNameForm({ currentName, isAdmin }: Props): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const isDirty = name.trim() !== currentName;

  async function handleSave(): Promise<void> {
    if (!name.trim() || saving || !isDirty) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to save");
      } else {
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setSaved(false); }}
        disabled={!isAdmin || saving}
        maxLength={100}
        style={{
          padding: "8px 10px",
          border: "1px solid var(--border)",
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "inherit",
          background: isAdmin ? "var(--bg-surface)" : "var(--bg-subtle)",
          color: isAdmin ? "var(--fg)" : "var(--fg-secondary)",
          maxWidth: 420,
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
          transition: "border-color 80ms",
        }}
        onFocus={(e) => { if (isAdmin) e.target.style.borderColor = "var(--fg-secondary)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
      />
      {error && (
        <span style={{ fontSize: 12, color: "var(--status-attention-fg)" }}>{error}</span>
      )}
      {isAdmin && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !isDirty || !name.trim()}
            style={{
              padding: "6px 14px",
              fontSize: 12.5,
              fontFamily: "inherit",
              cursor: saving || !isDirty || !name.trim() ? "not-allowed" : "pointer",
              background: "var(--fg)",
              color: "white",
              border: "none",
              borderRadius: 6,
              opacity: saving || !isDirty || !name.trim() ? 0.5 : 1,
              transition: "opacity 80ms",
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span style={{ fontSize: 12, color: "var(--status-approved-fg)" }}>Saved ✓</span>
          )}
        </div>
      )}
    </div>
  );
}

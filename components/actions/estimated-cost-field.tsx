"use client";

import { useRef, useState } from "react";

type Props = {
  actionId: string;
  projectId: string;
  initialCost: string | null;
  canEdit: boolean;
};

export function EstimatedCostField({
  actionId,
  projectId,
  initialCost,
  canEdit,
}: Props): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [current, setCurrent] = useState(initialCost);
  const [draft, setDraft] = useState(initialCost ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function openEdit(): void {
    setDraft(current ?? "");
    setError(null);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 20);
  }

  function cancelEdit(): void {
    setEditing(false);
    setError(null);
    setDraft(current ?? "");
  }

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError(null);
    try {
      // Fetch current full action data so we can send a valid PATCH
      const getRes = await fetch(
        `/api/projects/${projectId}/actions/${actionId}`
      );
      if (!getRes.ok) throw new Error("Failed to load action");
      const actionData = (await getRes.json()) as {
        ifcCategory: string;
        title: string;
        description: string | null;
        priority: string | null;
        targetDate: string | null;
        departmentHint: string | null;
        deliverables: Array<{
          id: string;
          description: string;
          documentHints: string[] | null;
        }>;
      };

      const patchRes = await fetch(
        `/api/projects/${projectId}/actions/${actionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ifcCategory: actionData.ifcCategory,
            title: actionData.title,
            description: actionData.description ?? undefined,
            priority: actionData.priority ?? undefined,
            targetDate: actionData.targetDate ?? undefined,
            departmentHint: actionData.departmentHint ?? undefined,
            estimatedCost: draft.trim() || null,
            deliverables: actionData.deliverables.map((d) => ({
              id: d.id,
              description: d.description,
              documentHints: d.documentHints ?? undefined,
            })),
          }),
        }
      );

      if (!patchRes.ok) {
        const body = (await patchRes.json()) as { error?: string };
        throw new Error(body.error ?? "Failed to save");
      }

      setCurrent(draft.trim() || null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSave();
            if (e.key === "Escape") cancelEdit();
          }}
          placeholder="e.g. ₹2,50,000 or $10,000"
          style={{
            width: "100%",
            padding: "5px 8px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            fontSize: 12.5,
            fontFamily: "inherit",
            background: "var(--bg)",
            color: "var(--fg)",
            boxSizing: "border-box",
            outline: "none",
          }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: "3px 10px",
              fontSize: 12,
              fontFamily: "inherit",
              background: "var(--fg)",
              color: "white",
              border: "none",
              borderRadius: "var(--radius)",
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button
            onClick={cancelEdit}
            disabled={saving}
            style={{
              padding: "3px 8px",
              fontSize: 12,
              fontFamily: "inherit",
              background: "transparent",
              color: "var(--fg-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
        {error && (
          <span style={{ fontSize: 11.5, color: "var(--status-returned-fg)" }}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <span
      onClick={canEdit ? openEdit : undefined}
      title={canEdit ? "Click to edit" : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        cursor: canEdit ? "pointer" : "default",
        color: current ? "var(--fg-secondary)" : "var(--fg-tertiary)",
        fontSize: 12.5,
      }}
    >
      {current ?? "Not set"}
      {canEdit && (
        <svg
          width="11"
          height="11"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}
        >
          <path d="M11 2l3 3-8 8H3v-3L11 2z" />
        </svg>
      )}
    </span>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { IfcCategory } from "@/lib/db/schema";

const IFC_OPTIONS: { value: IfcCategory; label: string }[] = [
  { value: "regulatory", label: "Regulatory Compliance" },
  { value: "c1",         label: "General Compliance" },
  { value: "ps1",        label: "PS1 · Assessment and Management of E&S Risks" },
  { value: "ps2",        label: "PS2 · Labor and Working Conditions" },
  { value: "ps3",        label: "PS3 · Resource Efficiency and Pollution Prevention" },
  { value: "ps4",        label: "PS4 · Community Health, Safety, and Security" },
  { value: "ps5",        label: "PS5 · Land Acquisition and Involuntary Resettlement" },
  { value: "ps6",        label: "PS6 · Biodiversity Conservation" },
  { value: "ps7",        label: "PS7 · Indigenous Peoples" },
  { value: "ps8",        label: "PS8 · Cultural Heritage" },
];

const PRIORITY_OPTIONS = [
  { value: "", label: "— Not set —" },
  { value: "critical", label: "Critical" },
  { value: "high",     label: "High" },
  { value: "medium",   label: "Medium" },
  { value: "low",      label: "Low" },
];

type DeliverableRow = {
  key: string;
  description: string;
  showHints: boolean;
  hints: string[];
};

type Props = {
  projectId: string;
  projectName: string;
  loaneeName: string;
};

function makeDeliverable(): DeliverableRow {
  return { key: crypto.randomUUID(), description: "", showHints: false, hints: [] };
}

export function NewActionModal({ projectId, projectName, loaneeName }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ifcCategory, setIfcCategory] = useState<IfcCategory>("ps2");
  const [priority, setPriority] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [departmentHint, setDepartmentHint] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [deliverableRows, setDeliverableRows] = useState<DeliverableRow[]>([makeDeliverable()]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const resetForm = useCallback(() => {
    setTitle("");
    setDescription("");
    setIfcCategory("ps2");
    setPriority("");
    setTargetDate("");
    setDepartmentHint("");
    setEstimatedCost("");
    setDeliverableRows([makeDeliverable()]);
    setError(null);
    setLoading(false);
  }, []);

  function openModal(): void {
    resetForm();
    setOpen(true);
  }

  function closeModal(): void {
    if (loading) return;
    setOpen(false);
  }

  // Focus title on open
  useEffect(() => {
    if (open) setTimeout(() => titleRef.current?.focus(), 50);
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Deliverable helpers
  function updateDeliverable(key: string, patch: Partial<DeliverableRow>): void {
    setDeliverableRows((rows) => rows.map((r) => r.key === key ? { ...r, ...patch } : r));
  }

  function removeDeliverable(key: string): void {
    setDeliverableRows((rows) => rows.filter((r) => r.key !== key));
  }

  function addDeliverable(): void {
    setDeliverableRows((rows) => [...rows, makeDeliverable()]);
  }

  function updateHint(dKey: string, hIdx: number, value: string): void {
    setDeliverableRows((rows) => rows.map((r) => {
      if (r.key !== dKey) return r;
      const hints = [...r.hints];
      hints[hIdx] = value;
      return { ...r, hints };
    }));
  }

  function addHint(dKey: string): void {
    setDeliverableRows((rows) => rows.map((r) =>
      r.key === dKey ? { ...r, hints: [...r.hints, ""] } : r
    ));
  }

  function removeHint(dKey: string, hIdx: number): void {
    setDeliverableRows((rows) => rows.map((r) =>
      r.key === dKey ? { ...r, hints: r.hints.filter((_, i) => i !== hIdx) } : r
    ));
  }

  const canSave = title.trim() && deliverableRows.every((d) => d.description.trim()) && !loading;

  async function handleSave(): Promise<void> {
    if (!canSave) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ifcCategory,
          title: title.trim(),
          description: description.trim() || undefined,
          priority: priority || undefined,
          targetDate: targetDate || undefined,
          departmentHint: departmentHint.trim() || undefined,
          estimatedCost: estimatedCost.trim() || undefined,
          deliverables: deliverableRows.map((d) => ({
            description: d.description.trim(),
            documentHints: d.showHints ? d.hints.filter(Boolean) : undefined,
          })),
        }),
      });
      const data = (await res.json()) as { actionId?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
      } else {
        window.location.href = `/projects/${projectId}/edit`;
      }
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={openModal}
        style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "5px 10px",
          background: "var(--fg)", color: "white",
          borderRadius: "var(--radius)", border: "none",
          fontSize: 12.5, fontWeight: 500, cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M8 2v12M2 8h12" />
        </svg>
        New Action
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.28)",
            zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-surface, #fff)",
              borderRadius: 12,
              boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.06)",
              width: "100%", maxWidth: 860,
              maxHeight: "90vh",
              display: "flex", flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "18px 24px 16px",
              borderBottom: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>New Action</div>
                <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2 }}>
                  {projectName} · will be assigned a number on save
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-tertiary)", padding: 4, borderRadius: 4, display: "flex", alignItems: "center" }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 240px",
              overflow: "hidden",
              flex: 1,
              minHeight: 0,
            }}>
              {/* Main */}
              <div style={{
                padding: "20px 24px",
                borderRight: "1px solid var(--border)",
                display: "flex", flexDirection: "column", gap: 18,
                overflowY: "auto",
              }}>
                <Field label="Topic">
                  <input
                    ref={titleRef}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Short name, e.g. 'Waste management plan'"
                    style={inputStyle}
                  />
                </Field>

                <Field label="Recommendation">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    placeholder={`The full recommendation as it will appear to ${loaneeName}. Be specific — vague recommendations are harder to evidence.`}
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
                  />
                </Field>

                <Field label="Measurable Outcomes (Deliverables)" hint={`Each deliverable becomes a checklist item for ${loaneeName}.`}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {deliverableRows.map((d, idx) => (
                      <DeliverableItem
                        key={d.key}
                        row={d}
                        letter={String.fromCharCode(97 + idx)}
                        canRemove={deliverableRows.length > 1}
                        onDescChange={(v) => updateDeliverable(d.key, { description: v })}
                        onRemove={() => removeDeliverable(d.key)}
                        onToggleHints={(v) => updateDeliverable(d.key, { showHints: v })}
                        onHintChange={(i, v) => updateHint(d.key, i, v)}
                        onAddHint={() => addHint(d.key)}
                        onRemoveHint={(i) => removeHint(d.key, i)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={addDeliverable}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      padding: "7px 8px", background: "transparent", border: "none",
                      fontFamily: "inherit", fontSize: 12.5, color: "var(--fg-tertiary)",
                      cursor: "pointer", borderRadius: 4, width: "100%", marginTop: 2,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M8 2v12M2 8h12" />
                    </svg>
                    Add deliverable
                  </button>
                </Field>
              </div>

              {/* Meta sidebar */}
              <div style={{
                padding: "20px",
                background: "var(--bg-subtle, #f8f8f8)",
                display: "flex", flexDirection: "column", gap: 16,
                overflowY: "auto",
              }}>
                <MetaField label="IFC Category">
                  <select value={ifcCategory} onChange={(e) => setIfcCategory(e.target.value as IfcCategory)} style={selectStyle}>
                    {IFC_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </MetaField>

                <MetaField label="Priority">
                  <select value={priority} onChange={(e) => setPriority(e.target.value)} style={selectStyle}>
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </MetaField>

                <MetaField label="Suggested department" hint="Hint for the loanee only. Doesn't assign anyone.">
                  <input
                    value={departmentHint}
                    onChange={(e) => setDepartmentHint(e.target.value)}
                    placeholder="e.g. Corporate HR, Site EHS"
                    style={inputStyle}
                  />
                </MetaField>

                <MetaField label="Target date">
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    style={inputStyle}
                  />
                </MetaField>

                <MetaField label="Estimated cost">
                  <input
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(e.target.value)}
                    placeholder="e.g. ₹2,50,000 or $10,000"
                    style={inputStyle}
                  />
                </MetaField>

                <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                    Status after save
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--fg-secondary)", lineHeight: 1.5 }}>
                    Action will be saved as <strong style={{ color: "var(--fg)" }}>Draft</strong> — invisible to {loaneeName} until you publish the action plan.
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "14px 24px",
              borderTop: "1px solid var(--border)",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 12, color: "var(--fg-tertiary)", marginRight: "auto" }}>
                Saving as Draft · <kbd style={{ fontFamily: "inherit", fontSize: 11, background: "var(--bg-subtle)", border: "1px solid var(--border)", borderRadius: 3, padding: "1px 4px" }}>Esc</kbd> to close
              </span>
              {error && <span style={{ fontSize: 12, color: "var(--status-returned-fg)" }}>{error}</span>}
              <button
                onClick={closeModal}
                disabled={loading}
                style={{
                  padding: "6px 14px", fontSize: 13, fontFamily: "inherit",
                  border: "1px solid var(--border)", background: "transparent",
                  color: "var(--fg-secondary)", borderRadius: "var(--radius)", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!canSave}
                style={{
                  padding: "6px 14px", fontSize: 13, fontFamily: "inherit", fontWeight: 500,
                  background: canSave ? "var(--fg)" : "var(--border)",
                  color: canSave ? "white" : "var(--fg-tertiary)",
                  border: "none", borderRadius: "var(--radius)", cursor: canSave ? "pointer" : "not-allowed",
                }}
              >
                {loading ? "Saving…" : "Save Action"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Deliverable item ──────────────────────────────────────────────────────────

function DeliverableItem({
  row, letter, canRemove,
  onDescChange, onRemove, onToggleHints, onHintChange, onAddHint, onRemoveHint,
}: {
  row: DeliverableRow;
  letter: string;
  canRemove: boolean;
  onDescChange: (v: string) => void;
  onRemove: () => void;
  onToggleHints: (v: boolean) => void;
  onHintChange: (i: number, v: string) => void;
  onAddHint: () => void;
  onRemoveHint: (i: number) => void;
}): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize(): void {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 6,
      background: "var(--bg)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 10px 10px 12px" }}>
        <span style={{
          fontFamily: "ui-monospace, monospace", fontSize: 11.5,
          color: "var(--fg-tertiary)", paddingTop: 9, flexShrink: 0, width: 18,
        }}>
          {letter})
        </span>
        <textarea
          ref={textareaRef}
          value={row.description}
          onChange={(e) => { onDescChange(e.target.value); autoResize(); }}
          onFocus={autoResize}
          rows={1}
          placeholder="e.g. Submitted waste management plan"
          style={{
            flex: 1, border: "none", background: "transparent",
            padding: "7px 4px", fontFamily: "inherit", fontSize: 13.5,
            color: "var(--fg)", resize: "none", outline: "none", lineHeight: 1.45,
            overflow: "hidden",
          }}
        />
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--fg-tertiary)", padding: 6, borderRadius: 4,
              flexShrink: 0, marginTop: 2, display: "flex", alignItems: "center",
            }}
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        )}
      </div>

      {/* Document hints toggle */}
      <div style={{ padding: "0 12px 10px 38px", display: "flex", alignItems: "center", gap: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 12, color: "var(--fg-secondary)" }}>
          <input
            type="checkbox"
            checked={row.showHints}
            onChange={(e) => {
              onToggleHints(e.target.checked);
              if (e.target.checked && row.hints.length === 0) onAddHint();
            }}
            style={{ cursor: "pointer" }}
          />
          Specify required documents
        </label>
        <span style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>Otherwise loanee uploads any files</span>
      </div>

      {/* Document hint slots */}
      {row.showHints && (
        <div style={{ padding: "0 12px 10px 38px", display: "flex", flexDirection: "column", gap: 5 }}>
          {row.hints.map((hint, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--fg-tertiary)", flexShrink: 0 }} />
              <input
                value={hint}
                onChange={(e) => onHintChange(i, e.target.value)}
                placeholder="e.g. Waste Management Plan (PDF)"
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                type="button"
                onClick={() => onRemoveHint(i)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-tertiary)", padding: 4, display: "flex", alignItems: "center" }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={onAddHint}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "4px 0", background: "none", border: "none",
              fontSize: 12, color: "var(--fg-tertiary)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 2v12M2 8h12" />
            </svg>
            Add document
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Small layout helpers ──────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)" }}>{label}</label>
      {children}
      {hint && <p style={{ margin: 0, fontSize: 12, color: "var(--fg-tertiary)" }}>{hint}</p>}
    </div>
  );
}

function MetaField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      {children}
      {hint && <p style={{ margin: 0, fontSize: 11.5, color: "var(--fg-tertiary)" }}>{hint}</p>}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  fontSize: 13,
  fontFamily: "inherit",
  background: "var(--bg)",
  color: "var(--fg)",
  boxSizing: "border-box",
  outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

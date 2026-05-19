"use client";

import { useState } from "react";

type BankOption = { id: string; name: string };

type Props = {
  banks: BankOption[];
  consultantName: string;
};

export function CreateProjectForm({ banks, consultantName }: Props): JSX.Element {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [bankWorkspaceId, setBankWorkspaceId] = useState(banks[0]?.id ?? "");
  const [loaneeName, setLoaneeName] = useState("");
  const [loaneeAdminEmail, setLoaneeAdminEmail] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationState, setLocationState] = useState("");
  const [constructionStartDate, setConstructionStartDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim() && bankWorkspaceId && loaneeName.trim() && loaneeAdminEmail.trim() && !loading;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          bankWorkspaceId,
          loaneeName: loaneeName.trim(),
          loaneeAdminEmail: loaneeAdminEmail.trim(),
          locationCity: locationCity.trim() || undefined,
          locationState: locationState.trim() || undefined,
          constructionStartDate: constructionStartDate || undefined,
        }),
      });
      const data = (await res.json()) as { projectId?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        setLoading(false);
      } else {
        window.location.href = `/projects/${data.projectId}`;
      }
    } catch {
      setError("Network error — please try again");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)}>
      {/* Progress steps */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
        {(["Project details", "Create actions", "Publish"] as const).map((label, i) => (
          <div key={label} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: i === 0 ? "var(--fg)" : "var(--border)",
                color: i === 0 ? "white" : "var(--fg-tertiary)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <span style={{
                fontSize: 13, fontWeight: i === 0 ? 600 : 400,
                color: i === 0 ? "var(--fg)" : "var(--fg-tertiary)",
              }}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div style={{ width: 32, height: 1, background: "var(--border)", margin: "0 10px" }} />
            )}
          </div>
        ))}
      </div>

      {/* Form card */}
      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>

        {/* ── Project section ── */}
        <FormSection title="Project">
          <Field label="Project name" hint="Used as the display name everywhere in Trace.">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Yamuna, Meridian Heights"
              required
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", gap: 16 }}>
            <Field label="City / District" style={{ flex: 1 }}>
              <input
                value={locationCity}
                onChange={(e) => setLocationCity(e.target.value)}
                placeholder="e.g. Noida"
                style={inputStyle}
              />
            </Field>
            <Field label="State" style={{ flex: 1 }}>
              <input
                value={locationState}
                onChange={(e) => setLocationState(e.target.value)}
                placeholder="e.g. Uttar Pradesh"
                style={inputStyle}
              />
            </Field>
          </div>

          <Field label="Construction start date">
            <input
              type="date"
              value={constructionStartDate}
              onChange={(e) => setConstructionStartDate(e.target.value)}
              style={inputStyle}
            />
          </Field>

          <Field label={<>Brief description <OptionalTag /></>}>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Summarise the project scope, land use type, and any key environmental or social risks."
              style={{ ...inputStyle, resize: "vertical" as const, fontFamily: "inherit" }}
            />
          </Field>
        </FormSection>

        {/* ── Lender section ── */}
        <FormSection title="Lender">
          <Field
            label="Bank / Lending institution"
            hint="Pick from banks your firm has been engaged by. To add a new bank, contact your admin."
          >
            {banks.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--fg-tertiary)", padding: "8px 0" }}>
                No banks found. Your admin needs to be invited by a bank first.
              </div>
            ) : (
              <select
                value={bankWorkspaceId}
                onChange={(e) => setBankWorkspaceId(e.target.value)}
                required
                style={selectStyle}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </Field>
        </FormSection>

        {/* ── Loanee section ── */}
        <FormSection title="Loanee">
          <Field label="Loanee firm name">
            <input
              value={loaneeName}
              onChange={(e) => setLoaneeName(e.target.value)}
              placeholder="e.g. Lodha Group"
              required
              style={inputStyle}
            />
          </Field>
          <Field
            label="Loanee admin email"
            hint="They'll receive an invite to join Trace as the loanee admin."
          >
            <input
              type="email"
              value={loaneeAdminEmail}
              onChange={(e) => setLoaneeAdminEmail(e.target.value)}
              placeholder="admin@loanee.com"
              required
              style={inputStyle}
            />
          </Field>
        </FormSection>

        {/* ── Team section ── */}
        <FormSection title={`${consultantName} team`} last>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: "#3F3F3F", color: "white",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, flexShrink: 0,
            }}>
              {consultantName.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{consultantName}</div>
              <div style={{ fontSize: 12, color: "var(--fg-tertiary)" }}>Lead consultant — assigned automatically</div>
            </div>
          </div>
        </FormSection>

      </div>

      {/* Footer */}
      {error && (
        <p style={{ margin: "16px 0 0", fontSize: 13, color: "var(--status-returned-fg)" }}>{error}</p>
      )}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "flex-end",
        gap: 10, marginTop: 20,
      }}>
        <span style={{ fontSize: 12, color: "var(--fg-tertiary)", marginRight: "auto" }}>
          You'll create the action plan on the next step.
        </span>
        <a
          href="/projects"
          style={{
            padding: "7px 14px", fontSize: 13, color: "var(--fg-secondary)",
            border: "1px solid var(--border)", borderRadius: "var(--radius)",
            textDecoration: "none", background: "transparent",
          }}
        >
          Cancel
        </a>
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "7px 16px", fontSize: 13, fontWeight: 500,
            background: canSubmit ? "var(--fg)" : "var(--border)",
            color: canSubmit ? "white" : "var(--fg-tertiary)",
            border: "none", borderRadius: "var(--radius)", cursor: canSubmit ? "pointer" : "not-allowed",
          }}
        >
          {loading ? "Creating…" : "Create project & continue"}
          {!loading && (
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 8h8M9 5l3 3-3 3" />
            </svg>
          )}
        </button>
      </div>
    </form>
  );
}

function FormSection({
  title,
  children,
  last,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}): JSX.Element {
  return (
    <div style={{
      padding: "24px 28px",
      borderBottom: last ? "none" : "1px solid var(--border)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--fg-tertiary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 18 }}>
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  style: containerStyle,
  children,
}: {
  label: React.ReactNode;
  hint?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div style={containerStyle}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--fg-secondary)", marginBottom: 6 }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ margin: "5px 0 0", fontSize: 12, color: "var(--fg-tertiary)" }}>{hint}</p>
      )}
    </div>
  );
}

function OptionalTag(): JSX.Element {
  return (
    <span style={{ fontWeight: 400, color: "var(--fg-tertiary)" }}>(optional)</span>
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
  appearance: "auto" as const,
};

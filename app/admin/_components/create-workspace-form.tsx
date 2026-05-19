"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateWorkspaceForm(): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), adminEmail: email.trim() }),
      });
      const data = (await res.json()) as { error?: string; token?: string };
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
      } else {
        setSuccess(`Workspace created. Invite sent to ${email.trim()}.`);
        setName("");
        setEmail("");
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={labelStyle}>Workspace name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. HDFC Capital"
          required
          style={inputStyle}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={labelStyle}>Admin email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="admin@bank.com"
          required
          style={inputStyle}
        />
      </div>
      {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
      {success && <p style={{ margin: 0, fontSize: 13, color: "#166534" }}>{success}</p>}
      <div>
        <button
          type="submit"
          disabled={loading || !name.trim() || !email.trim()}
          style={{
            padding: "7px 16px",
            fontSize: 13,
            fontFamily: "inherit",
            fontWeight: 500,
            background: loading || !name.trim() || !email.trim() ? "#888" : "#0A0A0A",
            color: "white",
            border: "none",
            borderRadius: 5,
            cursor: loading || !name.trim() || !email.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Creating…" : "Create workspace & send invite"}
        </button>
      </div>
    </form>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#555",
};

const inputStyle: React.CSSProperties = {
  padding: "7px 10px",
  border: "1px solid #ddd",
  borderRadius: 5,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#fff",
  color: "#111",
  width: "100%",
  maxWidth: 380,
  boxSizing: "border-box",
  outline: "none",
};

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage(): JSX.Element {
  const router = useRouter();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      if (res.ok) {
        router.push("/admin");
      } else {
        setError("Invalid password");
        setLoading(false);
      }
    } catch {
      setError("Network error");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 32, width: "100%", maxWidth: 360, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>Trace · Admin</div>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 24 }}>Platform operator access only.</div>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Admin password"
            required
            autoFocus
            style={{ padding: "8px 10px", border: "1px solid #ddd", borderRadius: 5, fontSize: 13, fontFamily: "inherit", outline: "none" }}
          />
          {error && <p style={{ margin: 0, fontSize: 13, color: "#b91c1c" }}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !secret}
            style={{ padding: "8px", fontSize: 13, fontFamily: "inherit", fontWeight: 500, background: loading || !secret ? "#888" : "#0A0A0A", color: "white", border: "none", borderRadius: 5, cursor: loading || !secret ? "not-allowed" : "pointer" }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

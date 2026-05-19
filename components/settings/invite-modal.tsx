"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = { workspaceName: string };

export function InviteModal({ workspaceName }: Props): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(): void {
    setOpen(false);
    setEmail("");
    setRole("member");
    setNote("");
    setError(null);
  }

  async function handleSend(): Promise<void> {
    if (!email.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role, note: note.trim() || undefined }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to send invite");
      } else {
        close();
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "6px 12px", fontSize: 12.5, fontFamily: "inherit",
          cursor: "pointer", background: "var(--fg)", color: "white",
          border: "none", borderRadius: 6,
        }}
      >
        + Invite member
      </button>

      {open && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)",
            zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
          }}
          onClick={close}
        >
          <div
            style={{
              background: "var(--bg-surface)", borderRadius: 10,
              boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)",
              width: "100%", maxWidth: 520,
              display: "flex", flexDirection: "column", overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 24px 16px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Invite member</div>
                <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2 }}>
                  They'll receive an email invite to join {workspaceName}.
                </div>
              </div>
              <button onClick={close} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-tertiary)", padding: 4, borderRadius: 4, display: "flex", alignItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-secondary)", letterSpacing: "0.01em" }}>Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  autoFocus
                  style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "var(--bg-surface)", color: "var(--fg)", outline: "none", width: "100%", boxSizing: "border-box" }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--fg-secondary)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleSend(); }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-secondary)", letterSpacing: "0.01em" }}>Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "member" | "admin")}
                  style={{ padding: "8px 28px 8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "var(--bg-surface)", color: "var(--fg)", appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='%238A8A8A' stroke-width='1.5'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", width: "100%", boxSizing: "border-box", outline: "none", cursor: "pointer" }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <span style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>Admins can invite others and manage workspace settings.</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-secondary)", letterSpacing: "0.01em" }}>
                  Personal note <span style={{ color: "var(--fg-tertiary)", fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Hi, joining you on Project Yamuna…"
                  style={{ padding: "9px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "var(--bg-surface)", color: "var(--fg)", resize: "vertical", lineHeight: 1.55, outline: "none", width: "100%", boxSizing: "border-box" }}
                  onFocus={(e) => { e.target.style.borderColor = "var(--fg-secondary)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                />
              </div>

              {error && <span style={{ fontSize: 12, color: "var(--status-attention-fg)" }}>{error}</span>}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "14px 24px", borderTop: "1px solid var(--border)" }}>
              <button onClick={close} style={{ padding: "6px 12px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg-secondary)" }}>
                Cancel
              </button>
              <button
                onClick={() => void handleSend()}
                disabled={loading || !email.trim()}
                style={{ padding: "6px 14px", fontSize: 12.5, fontFamily: "inherit", cursor: loading || !email.trim() ? "not-allowed" : "pointer", background: "var(--fg)", color: "white", border: "none", borderRadius: 6, opacity: loading || !email.trim() ? 0.5 : 1 }}
              >
                {loading ? "Sending…" : "Send invite"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

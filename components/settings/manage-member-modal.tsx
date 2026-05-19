"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { WorkspaceMemberRole } from "@/lib/db/schema";

type Props = {
  memberId: string;
  memberName: string;
  currentRole: WorkspaceMemberRole;
  isLastAdmin: boolean;
};

export function ManageMemberModal({ memberId, memberName, currentRole, isLastAdmin }: Props): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState<WorkspaceMemberRole>(currentRole);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close(): void {
    setOpen(false);
    setRole(currentRole);
    setConfirmRemove(false);
    setError(null);
  }

  async function handleConfirm(): Promise<void> {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      let res: Response;
      if (confirmRemove) {
        res = await fetch(`/api/settings/members/${memberId}`, { method: "DELETE" });
      } else {
        res = await fetch(`/api/settings/members/${memberId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role }),
        });
      }
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Something went wrong");
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

  const roleChanged = role !== currentRole;
  const canConfirm = confirmRemove || roleChanged;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          padding: "5px 10px", fontSize: 12, fontFamily: "inherit",
          cursor: "pointer", background: "transparent",
          border: "1px solid var(--border)", borderRadius: 6,
          color: "var(--fg-secondary)",
        }}
      >
        Manage
      </button>

      {open && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={close}
        >
          <div
            style={{ background: "var(--bg-surface)", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.06)", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", overflow: "hidden" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "18px 24px 16px", borderBottom: "1px solid var(--border)" }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>Manage member</div>
                <div style={{ fontSize: 12, color: "var(--fg-tertiary)", marginTop: 2 }}>Change role or remove {memberName} from the workspace.</div>
              </div>
              <button onClick={close} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--fg-tertiary)", padding: 4, borderRadius: 4, display: "flex", alignItems: "center" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 0 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--fg-secondary)", letterSpacing: "0.01em" }}>Role</label>
                <select
                  value={role}
                  onChange={(e) => { setRole(e.target.value as WorkspaceMemberRole); setConfirmRemove(false); }}
                  disabled={isLastAdmin && currentRole === "admin"}
                  style={{ padding: "8px 28px 8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "var(--bg-surface)", color: "var(--fg)", appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 16 16' fill='none' stroke='%238A8A8A' stroke-width='1.5'%3E%3Cpath d='M4 6l4 4 4-4'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", width: "100%", maxWidth: 280, boxSizing: "border-box", outline: "none", cursor: isLastAdmin && currentRole === "admin" ? "not-allowed" : "pointer", opacity: isLastAdmin && currentRole === "admin" ? 0.6 : 1 }}
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                </select>
                <span style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>Admins can invite others and manage workspace settings.</span>
              </div>

              {/* Remove section */}
              <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--border)" }}>
                {!confirmRemove ? (
                  <button
                    onClick={() => setConfirmRemove(true)}
                    disabled={isLastAdmin && currentRole === "admin"}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", fontSize: 12.5, fontFamily: "inherit", cursor: isLastAdmin && currentRole === "admin" ? "not-allowed" : "pointer", background: "transparent", border: "1px solid #FCA5A5", borderRadius: 6, color: "#9B2F2F", opacity: isLastAdmin && currentRole === "admin" ? 0.5 : 1 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M3 4h10M6 4V2h4v2M5 4v9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V4" />
                    </svg>
                    Remove from workspace
                  </button>
                ) : (
                  <div style={{ padding: "12px 14px", background: "var(--status-attention-bg)", border: "1px solid #FCA5A5", borderRadius: 6, fontSize: 12.5, color: "var(--status-attention-fg)", lineHeight: 1.5 }}>
                    Remove <strong>{memberName}</strong> from the workspace? They will lose access immediately.
                  </div>
                )}
                {isLastAdmin && currentRole === "admin" && (
                  <p style={{ marginTop: 8, fontSize: 11.5, color: "var(--fg-tertiary)" }}>Cannot demote or remove the last admin.</p>
                )}
              </div>

              {error && <span style={{ marginTop: 12, fontSize: 12, color: "var(--status-attention-fg)" }}>{error}</span>}
            </div>

            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8, padding: "14px 24px", borderTop: "1px solid var(--border)" }}>
              <button onClick={close} style={{ padding: "6px 12px", fontSize: 12.5, fontFamily: "inherit", cursor: "pointer", background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--fg-secondary)" }}>
                Cancel
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={loading || !canConfirm}
                style={{ padding: "6px 14px", fontSize: 12.5, fontFamily: "inherit", cursor: loading || !canConfirm ? "not-allowed" : "pointer", background: confirmRemove ? "#9B2F2F" : "var(--fg)", color: "white", border: "none", borderRadius: 6, opacity: loading || !canConfirm ? 0.5 : 1 }}
              >
                {loading ? "Saving…" : confirmRemove ? "Remove member" : "Confirm change"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

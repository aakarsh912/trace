"use client";

import { useState, useRef, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import type { WorkspaceOption } from "@/lib/auth/active-workspace";

type Props = {
  userName: string;
  initials: string;
  avatarBg: string;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string;
};

const ACCENT: Record<string, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

const TYPE_LABEL: Record<string, string> = {
  bank: "Bank",
  consultant: "Consultant",
  loanee: "Loanee",
};

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  member: "Member",
};

function wsInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return (words[0] ?? "").slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();
}

function switchWorkspace(workspaceId: string): void {
  document.cookie = `active_workspace=${workspaceId}; path=/; max-age=2592000; SameSite=Lax`;
  window.location.href = "/dashboard";
}

export function SidebarPersona({
  userName,
  initials,
  avatarBg,
  workspaces,
  activeWorkspaceId,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]!;

  useEffect(() => {
    function onOutsideClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, [open]);

  async function handleSignOut(): Promise<void> {
    setSigningOut(true);
    await signOut();
    window.location.href = "/login";
  }

  return (
    <div ref={ref} style={{ position: "relative", marginTop: "auto" }}>
      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
            overflow: "hidden",
            zIndex: 50,
          }}
        >
          {/* Workspace list */}
          <div style={{ padding: "6px 6px 0 6px" }}>
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => {
                    if (!isActive) switchWorkspace(ws.id);
                    else setOpen(false);
                  }}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    borderRadius: "var(--radius)",
                    border: "none",
                    background: isActive ? "var(--bg-subtle)" : "transparent",
                    cursor: isActive ? "default" : "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    marginBottom: 2,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive)
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                  }}
                >
                  {/* Workspace icon */}
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: ACCENT[ws.type] ?? "#555",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      flexShrink: 0,
                      letterSpacing: "0.02em",
                    }}
                  >
                    {wsInitials(ws.name)}
                  </div>

                  {/* Workspace info */}
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--fg)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {ws.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
                      {TYPE_LABEL[ws.type]} · {ROLE_LABEL[ws.role]}
                    </div>
                  </div>

                  {/* Active checkmark */}
                  {isActive && (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ color: "var(--fg)", flexShrink: 0 }}
                    >
                      <path d="M3 8l4 4 6-7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          {/* Divider + sign out */}
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0 0 0", padding: "4px 6px 6px 6px" }}>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 10px",
                borderRadius: "var(--radius)",
                fontSize: 12.5,
                color: signingOut ? "var(--fg-tertiary)" : "var(--fg)",
                background: "transparent",
                border: "none",
                cursor: signingOut ? "not-allowed" : "pointer",
                textAlign: "left",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => {
                if (!signingOut)
                  (e.currentTarget as HTMLElement).style.background = "var(--bg-subtle)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                style={{ flexShrink: 0, color: "var(--fg-tertiary)" }}
              >
                <path d="M10 8H2M2 8l3-3M2 8l3 3M6 4V3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-1" />
              </svg>
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        </div>
      )}

      {/* Persona row trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "10px 8px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          borderTop: "1px solid var(--border)",
          borderLeft: "none",
          borderRight: "none",
          borderBottom: "none",
          fontSize: 12,
          background: open ? "var(--bg-hover)" : "transparent",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: "inherit",
          borderRadius: 0,
          transition: "background 80ms",
        }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLElement).style.background = "var(--bg-hover)")
        }
        onMouseLeave={(e) => {
          if (!open)
            (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            background: avatarBg,
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {initials}
        </div>
        <div style={{ lineHeight: 1.3, minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: "var(--fg)",
              fontWeight: 500,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {userName}
          </div>
          <div style={{ color: "var(--fg-tertiary)", fontSize: 11 }}>
            {active.name} · {TYPE_LABEL[active.type]}
          </div>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          style={{
            color: "var(--fg-tertiary)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 120ms",
          }}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
    </div>
  );
}

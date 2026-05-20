"use client";

import { useState } from "react";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";
import { InviteModal } from "@/components/settings/invite-modal";
import { ManageMemberModal } from "@/components/settings/manage-member-modal";

type MemberRow = {
  memberId: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: WorkspaceMemberRole;
  joinedAt: Date;
};

type PendingInvite = {
  id: string;
  email: string;
  role: "admin" | "member";
  createdAt: Date;
  expiresAt: Date;
};

const AVATAR_BG: Record<WorkspaceType, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

function getInitials(firstName: string | null, lastName: string | null): string {
  return ((firstName?.[0] ?? "") + (lastName?.[0] ?? "")).toUpperCase() || "?";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

export function MembersClient({
  currentUserId,
  workspaceName,
  workspaceType,
  currentRole,
  members,
  pendingInvites,
  adminCount,
}: {
  currentUserId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  currentRole: WorkspaceMemberRole;
  members: MemberRow[];
  pendingInvites: PendingInvite[];
  adminCount: number;
}): JSX.Element {
  const [search, setSearch] = useState("");
  const isAdmin = currentRole === "admin";
  const avatarBg = AVATAR_BG[workspaceType];

  const q = search.toLowerCase();
  const filteredMembers = search
    ? members.filter((m) => {
        const fullName = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
        return (
          fullName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
        );
      })
    : members;

  const filteredInvites = search
    ? pendingInvites.filter((inv) => inv.email.toLowerCase().includes(q))
    : pendingInvites;

  const totalCount = filteredMembers.length + filteredInvites.length;

  return (
    <>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {isAdmin && <InviteModal workspaceName={workspaceName} />}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            padding: "5px 10px",
            background: "var(--bg-surface)",
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ color: "var(--fg-tertiary)", flexShrink: 0 }}
          >
            <circle cx="7" cy="7" r="4" />
            <path d="M10 10l3 3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            style={{
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 12.5,
              color: "var(--fg)",
              fontFamily: "inherit",
              width: 180,
            }}
          />
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--fg-tertiary)" }}>
          {totalCount} {totalCount === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Members table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {(["Member", "Role", "Joined", ""] as const).map((label) => (
              <th
                key={label}
                style={{
                  textAlign: "left",
                  padding: "10px 12px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--fg-tertiary)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((m) => {
            const isCurrentUser = m.userId === currentUserId;
            const isLastAdmin = m.role === "admin" && adminCount <= 1;
            const fullName =
              `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.email;
            const initials = getInitials(m.firstName, m.lastName);

            return (
              <tr key={m.memberId}>
                <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: avatarBg,
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 600,
                        flexShrink: 0,
                      }}
                    >
                      {initials}
                    </div>
                    <div style={{ lineHeight: 1.3 }}>
                      <div
                        style={{
                          fontWeight: 500,
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        {fullName}
                        {isCurrentUser && (
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--fg-tertiary)",
                              fontWeight: 400,
                            }}
                          >
                            (you)
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>
                        {m.email}
                      </div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 4,
                      background:
                        m.role === "admin" ? "#FEF3C7" : "var(--bg-subtle)",
                      color:
                        m.role === "admin" ? "#92400E" : "var(--fg-secondary)",
                    }}
                  >
                    {m.role === "admin" ? "Admin" : "Member"}
                  </span>
                </td>
                <td
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12,
                    color: "var(--fg-tertiary)",
                  }}
                >
                  {formatDate(m.joinedAt)}
                </td>
                <td
                  style={{
                    padding: "12px",
                    borderBottom: "1px solid var(--border)",
                    textAlign: "right",
                  }}
                >
                  {isAdmin && !isCurrentUser && (
                    <ManageMemberModal
                      memberId={m.memberId}
                      memberName={fullName}
                      currentRole={m.role}
                      isLastAdmin={isLastAdmin}
                    />
                  )}
                  {isCurrentUser && (
                    <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>
                      —
                    </span>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Pending invites */}
          {filteredInvites.map((inv) => (
            <tr key={inv.id}>
              <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--border)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      color: "var(--fg-tertiary)",
                      flexShrink: 0,
                    }}
                  >
                    ?
                  </div>
                  <div style={{ lineHeight: 1.3 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {inv.email}
                      <span
                        style={{
                          fontSize: 10.5,
                          color: "#9B7400",
                          background: "#FEF3C7",
                          padding: "1px 6px",
                          borderRadius: 3,
                          fontWeight: 500,
                        }}
                      >
                        Pending
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>
                      Invited {formatDate(inv.createdAt)}
                    </div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: 500,
                    borderRadius: 4,
                    background: "var(--bg-subtle)",
                    color: "var(--fg-secondary)",
                  }}
                >
                  {inv.role === "admin" ? "Admin" : "Member"}
                </span>
              </td>
              <td
                style={{
                  padding: "12px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12,
                  color: "var(--fg-tertiary)",
                }}
              >
                Expires {formatDate(inv.expiresAt)}
              </td>
              <td
                style={{
                  padding: "12px",
                  borderBottom: "1px solid var(--border)",
                  textAlign: "right",
                }}
              >
                {isAdmin && (
                  <span style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>
                    Invite pending
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {filteredMembers.length === 0 && filteredInvites.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--fg-tertiary)", marginTop: 16 }}>
          {search ? "No members match your search." : "No members yet."}
        </p>
      )}
    </>
  );
}

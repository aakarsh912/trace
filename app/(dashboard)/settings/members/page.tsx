import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users, workspaceMembers, workspaces, invites } from "@/lib/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";
import { InviteModal } from "@/components/settings/invite-modal";
import { ManageMemberModal } from "@/components/settings/manage-member-modal";

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

async function getMembersData(clerkUserId: string) {
  const [ctx] = await db
    .select({
      userId: users.id,
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
      role: workspaceMembers.role,
    })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(users.clerkUserId, clerkUserId), isNull(workspaceMembers.deletedAt), isNull(workspaces.deletedAt)))
    .limit(1);

  if (!ctx) return null;

  const memberRows = await db
    .select({
      memberId: workspaceMembers.id,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(
      eq(workspaceMembers.workspaceId, ctx.workspaceId),
      isNull(workspaceMembers.deletedAt),
      isNull(users.deletedAt)
    ))
    .orderBy(workspaceMembers.joinedAt);

  const pendingInvites = await db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
    })
    .from(invites)
    .where(and(
      eq(invites.workspaceId, ctx.workspaceId),
      isNull(invites.acceptedAt),
      gt(invites.expiresAt, new Date())
    ))
    .orderBy(invites.createdAt);

  const adminCount = memberRows.filter((m) => m.role === "admin").length;

  return {
    currentUserId: ctx.userId,
    workspaceId: ctx.workspaceId,
    workspaceName: ctx.workspaceName,
    workspaceType: ctx.workspaceType,
    currentRole: ctx.role as WorkspaceMemberRole,
    members: memberRows,
    pendingInvites,
    adminCount,
  };
}

export default async function MembersSettingsPage(): Promise<JSX.Element> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const data = await getMembersData(userId);
  if (!data) redirect("/login");

  const isAdmin = data.currentRole === "admin";
  const avatarBg = AVATAR_BG[data.workspaceType];
  const totalCount = data.members.length + data.pendingInvites.length;

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 6px" }}>Members</h1>
      <p style={{ fontSize: 13, color: "var(--fg-secondary)", margin: "0 0 24px", lineHeight: 1.5 }}>
        Manage who has access to {data.workspaceName}.
      </p>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
        {isAdmin && <InviteModal workspaceName={data.workspaceName} />}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--fg-tertiary)" }}>
          {totalCount} {totalCount === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Members table */}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--fg-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>Member</th>
            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--fg-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>Role</th>
            <th style={{ textAlign: "left", padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "var(--fg-tertiary)", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid var(--border)" }}>Joined</th>
            <th style={{ borderBottom: "1px solid var(--border)" }}></th>
          </tr>
        </thead>
        <tbody>
          {data.members.map((m) => {
            const isCurrentUser = m.userId === data.currentUserId;
            const isLastAdmin = m.role === "admin" && data.adminCount <= 1;
            const fullName = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim() || m.email;
            const initials = getInitials(m.firstName, m.lastName);

            return (
              <tr key={m.memberId}>
                <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarBg, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                      {initials}
                    </div>
                    <div style={{ lineHeight: 1.3 }}>
                      <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                        {fullName}
                        {isCurrentUser && (
                          <span style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 400 }}>(you)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>{m.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                  <span style={{
                    display: "inline-block", padding: "3px 8px", fontSize: 11, fontWeight: 500,
                    borderRadius: 4,
                    background: m.role === "admin" ? "#FEF3C7" : "var(--bg-subtle)",
                    color: m.role === "admin" ? "#92400E" : "var(--fg-secondary)",
                  }}>
                    {m.role === "admin" ? "Admin" : "Member"}
                  </span>
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--fg-tertiary)" }}>
                  {formatDate(m.joinedAt)}
                </td>
                <td style={{ padding: "12px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                  {isAdmin && !isCurrentUser && (
                    <ManageMemberModal
                      memberId={m.memberId}
                      memberName={fullName}
                      currentRole={m.role}
                      isLastAdmin={isLastAdmin}
                    />
                  )}
                  {isCurrentUser && (
                    <span style={{ fontSize: 11, color: "var(--fg-tertiary)" }}>—</span>
                  )}
                </td>
              </tr>
            );
          })}

          {/* Pending invites */}
          {data.pendingInvites.map((inv) => (
            <tr key={inv.id}>
              <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "var(--fg-tertiary)", flexShrink: 0 }}>
                    ?
                  </div>
                  <div style={{ lineHeight: 1.3 }}>
                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
                      {inv.email}
                      <span style={{ fontSize: 10.5, color: "#9B7400", background: "#FEF3C7", padding: "1px 6px", borderRadius: 3, fontWeight: 500 }}>
                        Pending
                      </span>
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>Invited {formatDate(inv.createdAt)}</div>
                  </div>
                </div>
              </td>
              <td style={{ padding: "12px", borderBottom: "1px solid var(--border)" }}>
                <span style={{ display: "inline-block", padding: "3px 8px", fontSize: 11, fontWeight: 500, borderRadius: 4, background: "var(--bg-subtle)", color: "var(--fg-secondary)" }}>
                  {inv.role === "admin" ? "Admin" : "Member"}
                </span>
              </td>
              <td style={{ padding: "12px", borderBottom: "1px solid var(--border)", fontSize: 12, color: "var(--fg-tertiary)" }}>
                Expires {formatDate(inv.expiresAt)}
              </td>
              <td style={{ padding: "12px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
                {isAdmin && (
                  <span style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>Invite pending</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.members.length === 0 && data.pendingInvites.length === 0 && (
        <p style={{ fontSize: 13, color: "var(--fg-tertiary)", marginTop: 16 }}>No members yet.</p>
      )}
    </>
  );
}

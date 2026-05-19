import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users, workspaceMembers, workspaces } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";
import { WorkspaceNameForm } from "@/components/settings/workspace-name-form";

const WS_TYPE_LABEL: Record<WorkspaceType, string> = {
  bank: "Bank / Lender",
  consultant: "Consultant firm",
  loanee: "Borrower / Loanee",
};

const AVATAR_BG: Record<WorkspaceType, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

async function getGeneralData(clerkUserId: string) {
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

  // Find the primary admin (oldest admin member)
  const admins = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(
      eq(workspaceMembers.workspaceId, ctx.workspaceId),
      eq(workspaceMembers.role, "admin"),
      isNull(workspaceMembers.deletedAt),
      isNull(users.deletedAt)
    ))
    .orderBy(workspaceMembers.joinedAt)
    .limit(1);

  const primaryAdmin = admins[0] ?? null;

  return {
    workspaceId: ctx.workspaceId,
    workspaceName: ctx.workspaceName,
    workspaceType: ctx.workspaceType,
    role: ctx.role as WorkspaceMemberRole,
    primaryAdmin: primaryAdmin
      ? {
          name: `${primaryAdmin.firstName ?? ""} ${primaryAdmin.lastName ?? ""}`.trim() || primaryAdmin.email,
          email: primaryAdmin.email,
          initials: ((primaryAdmin.firstName?.[0] ?? "") + (primaryAdmin.lastName?.[0] ?? "")).toUpperCase() || "?",
        }
      : null,
  };
}

export default async function GeneralSettingsPage(): Promise<JSX.Element> {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const data = await getGeneralData(userId);
  if (!data) redirect("/login");

  const isAdmin = data.role === "admin";
  const avatarBg = AVATAR_BG[data.workspaceType];

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 6px" }}>General</h1>
      <p style={{ fontSize: 13, color: "var(--fg-secondary)", margin: "0 0 28px", lineHeight: 1.5 }}>
        Manage your workspace details.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Workspace details section */}
        <div>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 4px" }}>Workspace details</h2>
          <p style={{ fontSize: 12.5, color: "var(--fg-tertiary)", margin: "0 0 18px" }}>
            Customize how your workspace appears across Trace.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Workspace name */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-secondary)" }}>Workspace name</label>
              <WorkspaceNameForm currentName={data.workspaceName} isAdmin={isAdmin} />
            </div>

            {/* Workspace type — readonly */}
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-secondary)" }}>Workspace type</label>
              <input
                readOnly
                value={WS_TYPE_LABEL[data.workspaceType]}
                style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "var(--bg-subtle)", color: "var(--fg-secondary)", maxWidth: 420, width: "100%", boxSizing: "border-box", outline: "none" }}
              />
              <span style={{ fontSize: 11.5, color: "var(--fg-tertiary)" }}>Workspace type cannot be changed after creation.</span>
            </div>

            {/* Primary admin */}
            {data.primaryAdmin && (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--fg-secondary)" }}>Primary admin</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, maxWidth: 420 }}>
                  <div style={{ width: 24, height: 24, background: avatarBg, color: "white", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>
                    {data.primaryAdmin.initials}
                  </div>
                  <div style={{ lineHeight: 1.25, flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--fg)" }}>{data.primaryAdmin.name}</div>
                    <div style={{ fontSize: 11, color: "var(--fg-tertiary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{data.primaryAdmin.email}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users, workspaceMembers, workspaces, invites } from "@/lib/db/schema";
import { eq, and, isNull, gt } from "drizzle-orm";
import type { WorkspaceMemberRole } from "@/lib/db/schema";
import { MembersClient } from "@/components/settings/members-client";

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

  return (
    <>
      <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 6px" }}>
        Members
      </h1>
      <p style={{ fontSize: 13, color: "var(--fg-secondary)", margin: "0 0 24px", lineHeight: 1.5 }}>
        Manage who has access to {data.workspaceName}.
      </p>

      <MembersClient
        currentUserId={data.currentUserId}
        workspaceName={data.workspaceName}
        workspaceType={data.workspaceType}
        currentRole={data.currentRole}
        members={data.members}
        pendingInvites={data.pendingInvites}
        adminCount={data.adminCount}
      />
    </>
  );
}

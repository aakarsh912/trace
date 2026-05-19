import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { users, workspaceMembers, workspaces } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";

export type SessionUser = {
  id: string;
  clerkUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

export type WorkspaceContext = {
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  workspaceSlug: string;
  role: WorkspaceMemberRole;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.clerkUserId, userId), isNull(users.deletedAt)));

  return user ?? null;
}

export async function getUserWorkspaces(
  userId: string
): Promise<WorkspaceContext[]> {
  const rows = await db
    .select({
      workspaceId: workspaces.id,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
      workspaceSlug: workspaces.slug,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt)
      )
    );

  return rows;
}

export async function syncClerkUser(): Promise<void> {
  const clerkUser = await currentUser();
  if (!clerkUser) return;

  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return;

  await db
    .insert(users)
    .values({
      clerkUserId: clerkUser.id,
      email,
      firstName: clerkUser.firstName,
      lastName: clerkUser.lastName,
    })
    .onConflictDoUpdate({
      target: users.clerkUserId,
      set: {
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      },
    });
}

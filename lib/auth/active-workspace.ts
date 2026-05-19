import { db } from "@/lib/db/client";
import { workspaceMembers, workspaces, users } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";

export type WorkspaceOption = {
  id: string;
  name: string;
  type: WorkspaceType;
  role: WorkspaceMemberRole;
};

export async function getAllWorkspacesForClerkUser(
  clerkUserId: string
): Promise<WorkspaceOption[]> {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      type: workspaces.type,
      role: workspaceMembers.role,
    })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(users.clerkUserId, clerkUserId),
        isNull(users.deletedAt),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt)
      )
    );
}

export function resolveActiveWorkspace(
  all: WorkspaceOption[],
  cookieValue: string | undefined
): WorkspaceOption | null {
  if (all.length === 0) return null;
  if (cookieValue) {
    const match = all.find((w) => w.id === cookieValue);
    if (match) return match;
  }
  return all[0] ?? null;
}

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users, workspaceMembers, workspaces } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { SettingsNav } from "@/components/settings/settings-nav";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";

async function getSettingsContext(): Promise<{
  workspaceType: WorkspaceType;
  role: WorkspaceMemberRole;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const [row] = await db
    .select({ workspaceType: workspaces.type, role: workspaceMembers.role })
    .from(users)
    .innerJoin(workspaceMembers, eq(workspaceMembers.userId, users.id))
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(users.clerkUserId, userId), isNull(workspaceMembers.deletedAt), isNull(workspaces.deletedAt)))
    .limit(1);

  return row ?? null;
}

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const ctx = await getSettingsContext();
  if (!ctx) redirect("/login");

  return (
    <div style={{ margin: "-24px", minHeight: "calc(100vh - 48px)", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", flex: 1 }}>
        <SettingsNav role={ctx.role} />
        <div style={{ padding: "32px 40px", maxWidth: 760 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

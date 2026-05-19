import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { getAllWorkspacesForClerkUser, resolveActiveWorkspace } from "@/lib/auth/active-workspace";

async function getUserDisplayName(clerkUserId: string): Promise<string> {
  const rows = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId))
    .limit(1);
  const row = rows[0];
  if (!row) return "User";
  return `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() || "User";
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) redirect("/login");

  const [allWorkspaces, userName] = await Promise.all([
    getAllWorkspacesForClerkUser(clerkUserId),
    getUserDisplayName(clerkUserId),
  ]);

  if (allWorkspaces.length === 0) redirect("/login");

  const cookieStore = cookies();
  const activeId = cookieStore.get("active_workspace")?.value;
  const active = resolveActiveWorkspace(allWorkspaces, activeId);
  if (!active) redirect("/login");

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar
        userName={userName}
        workspaces={allWorkspaces}
        activeWorkspaceId={active.id}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 0,
          background: "var(--bg-surface)",
        }}
      >
        <Topbar />
        <main style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}

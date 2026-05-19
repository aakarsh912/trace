import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import { workspaces, workspaceMembers, projects, invites, users } from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { CreateProjectForm } from "@/components/projects/create-project-form";

async function getContext(userId: string): Promise<{
  workspaceId: string;
  consultantName: string;
  userDisplayName: string;
} | null> {
  const [row] = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      wsType: workspaces.type,
      wsName: workspaces.name,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(
      and(
        eq(workspaceMembers.userId, userId),
        isNull(workspaceMembers.deletedAt),
        isNull(workspaces.deletedAt)
      )
    )
    .limit(1);

  if (!row || row.wsType !== "consultant" || row.role !== "admin") return null;
  return { workspaceId: row.workspaceId, consultantName: row.wsName, userDisplayName: row.wsName };
}

async function getAvailableBanks(consultantWorkspaceId: string): Promise<{ id: string; name: string }[]> {
  // Banks already linked via existing projects
  const fromProjects = await db
    .selectDistinct({ id: workspaces.id, name: workspaces.name })
    .from(workspaces)
    .innerJoin(projects, eq(projects.bankWorkspaceId, workspaces.id))
    .where(
      and(
        eq(projects.consultantWorkspaceId, consultantWorkspaceId),
        isNull(projects.deletedAt),
        isNull(workspaces.deletedAt)
      )
    );

  // Banks whose users invited members of this consultant workspace
  // (captures the bank-invites-consultant flow)
  const fromInvites = await db.execute<{ id: string; name: string }>(
    sql`SELECT DISTINCT w.id, w.name
        FROM invites inv
        JOIN users inviter ON inviter.id = inv.invited_by_id
        JOIN workspace_members wm ON wm.user_id = inviter.id AND wm.deleted_at IS NULL
        JOIN workspaces w ON w.id = wm.workspace_id AND w.deleted_at IS NULL
        WHERE w.type = 'bank'
          AND inv.workspace_id = ${consultantWorkspaceId}
          AND inv.accepted_at IS NOT NULL`
  );

  const seen = new Set<string>();
  const banks: { id: string; name: string }[] = [];

  for (const b of [...fromProjects, ...(fromInvites.rows as { id: string; name: string }[])]) {
    if (!seen.has(b.id)) {
      seen.add(b.id);
      banks.push({ id: b.id, name: b.name });
    }
  }

  // Fallback: all bank workspaces if none found (e.g. first project for this consultant)
  if (banks.length === 0) {
    const allBanks = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(and(eq(workspaces.type, "bank"), isNull(workspaces.deletedAt)));
    return allBanks;
  }

  return banks;
}

export default async function NewProjectPage(): Promise<JSX.Element> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const ctx = await getContext(user.id);
  if (!ctx) redirect("/projects");

  const banks = await getAvailableBanks(ctx.workspaceId);

  const userDisplayName = [
    (user as { firstName?: string | null }).firstName,
    (user as { lastName?: string | null }).lastName,
  ].filter(Boolean).join(" ") || ctx.consultantName;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 760 }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 24, fontSize: 13, color: "var(--fg-tertiary)" }}>
        <Link href="/projects" style={{ color: "var(--fg-tertiary)", textDecoration: "none" }}>
          Projects
        </Link>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M6 4l4 4-4 4" />
        </svg>
        <span style={{ color: "var(--fg)" }}>New project</span>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--fg)", margin: "0 0 4px", letterSpacing: "-0.02em" }}>
          Create a new project
        </h1>
        <p style={{ fontSize: 13, color: "var(--fg-tertiary)", margin: 0 }}>
          Set up the engagement. You&apos;ll build the action plan on the next step.
        </p>
      </div>

      <CreateProjectForm
        banks={banks}
        consultantName={userDisplayName}
      />
    </div>
  );
}

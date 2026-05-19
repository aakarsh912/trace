import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { actions, projects, workspaceMembers, workspaces, users, invites } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getCurrentUser } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";
import { sendActionPlanPublishedEmail } from "@/lib/email/send";

export async function POST(
  _req: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  const tag = `[api/projects/${params.projectId}/publish]`;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [membership] = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        wsType: workspaces.type,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.userId, user.id),
          isNull(workspaceMembers.deletedAt),
          isNull(workspaces.deletedAt)
        )
      )
      .limit(1);

    if (!membership || membership.wsType !== "consultant") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!can(membership.wsType, membership.role, "project:publish")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const loaneeWs = alias(workspaces, "loanee_ws");
    const consultantWs = alias(workspaces, "consultant_ws");

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        loaneeWorkspaceId: projects.loaneeWorkspaceId,
        loaneeName: loaneeWs.name,
        consultantName: consultantWs.name,
      })
      .from(projects)
      .innerJoin(loaneeWs, eq(projects.loaneeWorkspaceId, loaneeWs.id))
      .innerJoin(consultantWs, eq(projects.consultantWorkspaceId, consultantWs.id))
      .where(
        and(
          eq(projects.id, params.projectId),
          eq(projects.consultantWorkspaceId, membership.workspaceId),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db
      .update(projects)
      .set({ isPublished: true, publishedAt: new Date() })
      .where(eq(projects.id, params.projectId));

    const updatedActions = await db
      .update(actions)
      .set({ isPublished: true })
      .where(and(eq(actions.projectId, params.projectId), isNull(actions.deletedAt)))
      .returning({ id: actions.id });

    console.log(`${tag} published ${updatedActions.length} actions`);

    // Find loanee admin — prefer accepted member, fall back to pending invite
    const [loaneeAdmin] = await db
      .select({ email: users.email })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(
        and(
          eq(workspaceMembers.workspaceId, project.loaneeWorkspaceId),
          eq(workspaceMembers.role, "admin"),
          isNull(workspaceMembers.deletedAt),
          isNull(users.deletedAt)
        )
      )
      .limit(1);

    let emailTo: string | null = loaneeAdmin?.email ?? null;

    if (!emailTo) {
      const [pendingInvite] = await db
        .select({ email: invites.email })
        .from(invites)
        .where(
          and(
            eq(invites.workspaceId, project.loaneeWorkspaceId),
            isNull(invites.acceptedAt)
          )
        )
        .limit(1);
      emailTo = pendingInvite?.email ?? null;
    }

    if (emailTo) {
      await sendActionPlanPublishedEmail(emailTo, {
        projectName: project.name,
        loaneeWorkspaceName: project.loaneeName,
        consultantWorkspaceName: project.consultantName,
        actionCount: updatedActions.length,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/projects/${params.projectId}`,
      });
    } else {
      console.warn(`${tag} no loanee email found, skipping notification`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

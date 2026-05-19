import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  actions,
  projects,
  users,
  workspaceMembers,
  workspaces,
  activityLog,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";
import { sendActionAssignedEmail } from "@/lib/email/send";

const schema = z.object({
  assignedToId: z.string().nullable(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string; actionId: string } }
): Promise<NextResponse> {
  const tag = `[api/actions/${params.actionId}/assign]`;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Must be loanee workspace member
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

    if (!membership || membership.wsType !== "loanee") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!can("loanee", membership.role, "deliverable:assign")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the action belongs to a project that includes this loanee workspace
    const [project] = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(
        and(
          eq(projects.id, params.projectId),
          eq(projects.loaneeWorkspaceId, membership.workspaceId),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [action] = await db
      .select({ id: actions.id, title: actions.title, actionNumber: actions.actionNumber, isPublished: actions.isPublished })
      .from(actions)
      .where(
        and(
          eq(actions.id, params.actionId),
          eq(actions.projectId, params.projectId),
          isNull(actions.deletedAt)
        )
      )
      .limit(1);

    if (!action || !action.isPublished) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
    }

    const { assignedToId } = parsed.data;

    // If assigning to someone, verify they're a member of this loanee workspace
    if (assignedToId !== null) {
      const [targetMembership] = await db
        .select({ userId: workspaceMembers.userId })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.userId, assignedToId),
            eq(workspaceMembers.workspaceId, membership.workspaceId),
            isNull(workspaceMembers.deletedAt)
          )
        )
        .limit(1);

      if (!targetMembership) {
        return NextResponse.json({ error: "Assignee is not a member of this workspace" }, { status: 400 });
      }
    }

    // Update the action
    await db
      .update(actions)
      .set({ assignedToId })
      .where(eq(actions.id, params.actionId));

    // Activity log
    await db.insert(activityLog).values({
      workspaceId: membership.workspaceId,
      projectId: params.projectId,
      actorId: user.id,
      eventType: assignedToId ? "action.assigned" : "action.unassigned",
      entityId: params.actionId,
      entityType: "action",
      metadata: JSON.stringify({ assignedToId }),
    });

    // Send email if assigning (not unassigning)
    if (assignedToId) {
      try {
        const [assignee] = await db
          .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, assignedToId))
          .limit(1);

        if (assignee?.email) {
          const assignerName =
            [user.firstName, user.lastName].filter(Boolean).join(" ") || "Your admin";
          const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

          await sendActionAssignedEmail(assignee.email, {
            actionNumber: action.actionNumber,
            actionTitle: action.title,
            projectName: project.name,
            assignerName,
            actionUrl: `${appUrl}/projects/${params.projectId}/actions/${params.actionId}`,
          });
        }
      } catch (emailErr) {
        console.error(`${tag} email failed (non-fatal):`, emailErr);
      }
    }

    console.log(`${tag} assigned action=${params.actionId} to=${assignedToId ?? "null"}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

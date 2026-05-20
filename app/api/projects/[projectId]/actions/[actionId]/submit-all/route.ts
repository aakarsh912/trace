import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  deliverables,
  actions,
  projects,
  documents,
  users,
  workspaceMembers,
  workspaces,
  activityLog,
} from "@/lib/db/schema";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { getCurrentUser, getUserWorkspaces } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";
import { sendDeliverableSubmittedEmail } from "@/lib/email/send";

export async function POST(
  _req: NextRequest,
  { params }: { params: { projectId: string; actionId: string } }
): Promise<NextResponse> {
  const tag = `[api/actions/${params.actionId}/submit-all]`;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userWorkspaces = await getUserWorkspaces(user.id);
    const ws = userWorkspaces.find((w) => w.workspaceType === "loanee");
    if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!can(ws.workspaceType, ws.role, "document:upload")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify the action belongs to a project this loanee workspace is on
    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        consultantWorkspaceId: projects.consultantWorkspaceId,
      })
      .from(projects)
      .where(
        and(
          eq(projects.id, params.projectId),
          eq(projects.loaneeWorkspaceId, ws.workspaceId),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const [action] = await db
      .select({
        id: actions.id,
        actionNumber: actions.actionNumber,
        title: actions.title,
        isPublished: actions.isPublished,
      })
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

    // Find all pending deliverables for this action that have a current document
    const pendingDelivs = await db
      .select({
        id: deliverables.id,
        letter: deliverables.letter,
        description: deliverables.description,
        status: deliverables.status,
      })
      .from(deliverables)
      .where(
        and(
          eq(deliverables.actionId, params.actionId),
          eq(deliverables.status, "pending"),
          isNull(deliverables.deletedAt)
        )
      );

    if (pendingDelivs.length === 0) {
      return NextResponse.json({ error: "No pending deliverables to submit" }, { status: 400 });
    }

    // Filter to those with a current document
    const pendingIds = pendingDelivs.map((d) => d.id);
    const currentDocs = await db
      .select({ deliverableId: documents.deliverableId })
      .from(documents)
      .where(
        and(
          inArray(documents.deliverableId, pendingIds),
          eq(documents.isCurrent, true),
          isNull(documents.deletedAt)
        )
      );

    const delivsWithDoc = new Set(currentDocs.map((d) => d.deliverableId));
    const toSubmit = pendingDelivs.filter((d) => delivsWithDoc.has(d.id));

    if (toSubmit.length === 0) {
      return NextResponse.json({ error: "No deliverables with uploaded files to submit" }, { status: 400 });
    }

    const toSubmitIds = toSubmit.map((d) => d.id);

    // Mark all as submitted
    await db
      .update(deliverables)
      .set({ status: "submitted" })
      .where(inArray(deliverables.id, toSubmitIds));

    // Activity log
    await db.insert(activityLog).values({
      workspaceId: ws.workspaceId,
      projectId: params.projectId,
      actorId: user.id,
      eventType: "action.submitted",
      entityId: params.actionId,
      entityType: "action",
      metadata: JSON.stringify({ count: toSubmit.length }),
    });

    // Notify consultant admin(s)
    try {
      const consultantAdmins = await db
        .select({ email: users.email, firstName: users.firstName, lastName: users.lastName })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
        .where(
          and(
            eq(workspaceMembers.workspaceId, project.consultantWorkspaceId),
            eq(workspaceMembers.role, "admin"),
            isNull(workspaceMembers.deletedAt),
            isNull(users.deletedAt)
          )
        );

      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const submitterName =
        [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
      const actionUrl = `${appUrl}/projects/${params.projectId}/actions/${params.actionId}`;

      for (const admin of consultantAdmins) {
        if (!admin.email) continue;
        for (const deliv of toSubmit) {
          await sendDeliverableSubmittedEmail(admin.email, {
            actionNumber: action.actionNumber,
            actionTitle: action.title,
            deliverableLetter: deliv.letter,
            deliverableDescription: deliv.description,
            submitterName,
            loaneeWorkspaceName: ws.workspaceName,
            actionUrl,
          });
        }
      }
    } catch (emailErr) {
      console.error(`${tag} email failed (non-fatal):`, emailErr);
    }

    console.log(`${tag} submitted ${toSubmit.length} deliverables for action=${params.actionId}`);
    return NextResponse.json({ ok: true, submittedCount: toSubmit.length });
  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

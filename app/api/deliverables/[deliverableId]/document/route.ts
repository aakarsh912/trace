import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { deliverables, actions, projects, documents, activityLog } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser, getUserWorkspaces } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { deliverableId: string } }
): Promise<NextResponse> {
  const tag = `[api/deliverables/${params.deliverableId}/document]`;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userWorkspaces = await getUserWorkspaces(user.id);
    const ws = userWorkspaces.find((w) => w.workspaceType === "loanee");
    if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    if (!can(ws.workspaceType, ws.role, "document:upload")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find the deliverable and its current document
    const [row] = await db
      .select({
        status: deliverables.status,
        projectId: projects.id,
        loaneeWorkspaceId: projects.loaneeWorkspaceId,
      })
      .from(deliverables)
      .innerJoin(actions, eq(deliverables.actionId, actions.id))
      .innerJoin(projects, eq(actions.projectId, projects.id))
      .where(
        and(
          eq(deliverables.id, params.deliverableId),
          isNull(deliverables.deletedAt),
          isNull(actions.deletedAt),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (row.loaneeWorkspaceId !== ws.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (row.status === "approved") {
      return NextResponse.json({ error: "Approved deliverables are locked" }, { status: 400 });
    }

    // Find the current document uploaded by this user
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.deliverableId, params.deliverableId),
          eq(documents.isCurrent, true),
          eq(documents.uploadedById, user.id),
          isNull(documents.deletedAt)
        )
      )
      .limit(1);

    if (!doc) {
      return NextResponse.json({ error: "No document found or not uploaded by you" }, { status: 404 });
    }

    // Soft-delete the document
    await db
      .update(documents)
      .set({ deletedAt: new Date(), isCurrent: false })
      .where(eq(documents.id, doc.id));

    // Reset deliverable status to pending
    await db
      .update(deliverables)
      .set({ status: "pending" })
      .where(eq(deliverables.id, params.deliverableId));

    // Activity log
    await db.insert(activityLog).values({
      workspaceId: ws.workspaceId,
      projectId: row.projectId,
      actorId: user.id,
      eventType: "document_removed",
      entityId: params.deliverableId,
      entityType: "deliverable",
    });

    console.log(`${tag} removed document for deliverable=${params.deliverableId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  deliverables,
  actions,
  projects,
  documents,
  reviews,
  activityLog,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser, getUserWorkspaces } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";
import { sendDeliverableApprovedEmail, sendDeliverableSentBackEmail } from "@/lib/email/send";

const schema = z.object({
  decision: z.enum(["approved", "sent_back"]),
  comment: z.string().min(1).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { deliverableId: string } }
): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userWorkspaces = await getUserWorkspaces(user.id);
  const ws = userWorkspaces.find((w) => w.workspaceType === "consultant");
  if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!can(ws.workspaceType, ws.role, "review:approve")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { decision, comment } = parsed.data;

  if (decision === "sent_back" && !comment) {
    return NextResponse.json(
      { error: "A reason is required when sending back" },
      { status: 400 }
    );
  }

  const [row] = await db
    .select({
      deliverableId: deliverables.id,
      deliverableStatus: deliverables.status,
      letter: deliverables.letter,
      description: deliverables.description,
      actionId: actions.id,
      actionNumber: actions.actionNumber,
      actionTitle: actions.title,
      projectId: projects.id,
      consultantWorkspaceId: projects.consultantWorkspaceId,
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

  if (row.consultantWorkspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.deliverableStatus !== "submitted") {
    return NextResponse.json(
      { error: "Can only review submitted deliverables" },
      { status: 400 }
    );
  }

  await db
    .update(deliverables)
    .set({ status: decision })
    .where(eq(deliverables.id, params.deliverableId));

  await db.insert(reviews).values({
    deliverableId: params.deliverableId,
    reviewedById: user.id,
    decision,
    comment: comment ?? null,
  });

  await db.insert(activityLog).values({
    workspaceId: ws.workspaceId,
    projectId: row.projectId,
    actorId: user.id,
    eventType:
      decision === "approved"
        ? "deliverable_approved"
        : "deliverable_sent_back",
    entityId: params.deliverableId,
    entityType: "deliverable",
  });

  // Email: notify the loanee who submitted the current document
  const [currentDoc] = await db
    .select({ uploadedById: documents.uploadedById })
    .from(documents)
    .where(and(eq(documents.deliverableId, params.deliverableId), eq(documents.isCurrent, true)))
    .limit(1);

  if (currentDoc?.uploadedById) {
    const [submitter] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, currentDoc.uploadedById))
      .limit(1);

    if (submitter) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const reviewerName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
      const actionUrl = `${appUrl}/projects/${row.projectId}/actions/${row.actionId}`;
      const emailProps = {
        actionNumber: row.actionNumber,
        actionTitle: row.actionTitle,
        deliverableLetter: row.letter,
        deliverableDescription: row.description,
        reviewerName,
        actionUrl,
      };

      if (decision === "approved") {
        await sendDeliverableApprovedEmail(submitter.email, emailProps);
      } else {
        await sendDeliverableSentBackEmail(submitter.email, {
          ...emailProps,
          reviewComment: comment!,
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}

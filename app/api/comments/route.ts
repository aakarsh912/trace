import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { comments, actions, projects, activityLog } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser, getUserWorkspaces } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";

const schema = z.object({
  actionId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userWorkspaces = await getUserWorkspaces(user.id);
  const commentableWs = userWorkspaces.find((w) =>
    can(w.workspaceType, w.role, "comment:create")
  );
  if (!commentableWs) {
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

  const { actionId, body: commentBody } = parsed.data;

  const [actionRow] = await db
    .select({
      projectId: projects.id,
      bankWorkspaceId: projects.bankWorkspaceId,
      consultantWorkspaceId: projects.consultantWorkspaceId,
      loaneeWorkspaceId: projects.loaneeWorkspaceId,
    })
    .from(actions)
    .innerJoin(projects, eq(actions.projectId, projects.id))
    .where(
      and(
        eq(actions.id, actionId),
        isNull(actions.deletedAt),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (!actionRow) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const projectWsIds = [
    actionRow.bankWorkspaceId,
    actionRow.consultantWorkspaceId,
    actionRow.loaneeWorkspaceId,
  ];
  const userWsIds = userWorkspaces.map((w) => w.workspaceId);
  const hasAccess = userWsIds.some((id) => projectWsIds.includes(id));
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [comment] = await db
    .insert(comments)
    .values({
      actionId,
      authorId: user.id,
      body: commentBody,
    })
    .returning();

  if (comment) {
    await db.insert(activityLog).values({
      workspaceId: commentableWs.workspaceId,
      projectId: actionRow.projectId,
      actorId: user.id,
      eventType: "comment_posted",
      entityId: comment.id,
      entityType: "comment",
    });
  }

  return NextResponse.json({ ok: true });
}

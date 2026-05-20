import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  deliverables,
  actions,
  projects,
  documents,
  activityLog,
} from "@/lib/db/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import { getCurrentUser, getUserWorkspaces } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";

const schema = z.object({
  fileKey: z.string().min(1),
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { deliverableId: string } }
): Promise<NextResponse> {
  try {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userWorkspaces = await getUserWorkspaces(user.id);
  const ws = userWorkspaces.find((w) => w.workspaceType === "loanee");
  if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!can(ws.workspaceType, ws.role, "document:upload")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { fileKey, fileName, fileSize, mimeType } = parsed.data;

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
    return NextResponse.json(
      { error: "This deliverable is approved and locked" },
      { status: 400 }
    );
  }

  // Get next version number
  const [versionRow] = await db
    .select({
      maxVersion: sql<number>`coalesce(max(${documents.version}), 0)`,
    })
    .from(documents)
    .where(
      and(
        eq(documents.deliverableId, params.deliverableId),
        isNull(documents.deletedAt)
      )
    );

  const nextVersion = (versionRow?.maxVersion ?? 0) + 1;

  // Retire existing current document
  await db
    .update(documents)
    .set({ isCurrent: false })
    .where(
      and(
        eq(documents.deliverableId, params.deliverableId),
        eq(documents.isCurrent, true)
      )
    );

  // Insert new document
  await db.insert(documents).values({
    deliverableId: params.deliverableId,
    uploadedById: user.id,
    fileName,
    fileKey,
    fileSize,
    mimeType,
    version: nextVersion,
    isCurrent: true,
  });

  // Reset status to pending (upload saves the file but does not submit for review)
  await db
    .update(deliverables)
    .set({ status: "pending" })
    .where(eq(deliverables.id, params.deliverableId));

  // Activity log
  await db.insert(activityLog).values({
    workspaceId: ws.workspaceId,
    projectId: row.projectId,
    actorId: user.id,
    eventType: "document_uploaded",
    entityId: params.deliverableId,
    entityType: "deliverable",
  });

  return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[submit]", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

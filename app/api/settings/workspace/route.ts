import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { workspaces, workspaceMembers, users, activityLog } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";

const schema = z.object({
  name: z.string().min(1).max(100),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const [membership] = await db
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role, wsType: workspaces.type })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(eq(users.id, user.id), isNull(workspaceMembers.deletedAt), isNull(workspaces.deletedAt)))
      .limit(1);

    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!can(membership.wsType, membership.role, "settings:edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(workspaces)
      .set({ name: parsed.data.name })
      .where(eq(workspaces.id, membership.workspaceId));

    await db.insert(activityLog).values({
      workspaceId: membership.workspaceId,
      actorId: user.id,
      eventType: "workspace_updated",
      entityId: membership.workspaceId,
      entityType: "workspace",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[workspace-patch]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

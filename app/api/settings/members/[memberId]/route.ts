import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { workspaceMembers, workspaces, users, activityLog } from "@/lib/db/schema";
import { eq, and, isNull, count } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";

const patchSchema = z.object({
  role: z.enum(["admin", "member"]),
});

async function getActorMembership(userId: string) {
  const [row] = await db
    .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role, wsType: workspaces.type })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(and(eq(users.id, userId), isNull(workspaceMembers.deletedAt), isNull(workspaces.deletedAt)))
    .limit(1);
  return row ?? null;
}

async function countAdmins(workspaceId: string): Promise<number> {
  const [row] = await db
    .select({ cnt: count() })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.role, "admin"),
      isNull(workspaceMembers.deletedAt)
    ));
  return row?.cnt ?? 0;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }

    const actor = await getActorMembership(user.id);
    if (!actor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!can(actor.wsType, actor.role, "member:change_role")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [target] = await db
      .select({ role: workspaceMembers.role, workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, params.memberId), isNull(workspaceMembers.deletedAt)))
      .limit(1);

    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.workspaceId !== actor.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Guard: can't demote the last admin
    if (target.role === "admin" && parsed.data.role === "member") {
      const adminCount = await countAdmins(actor.workspaceId);
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot demote the last admin" }, { status: 400 });
      }
    }

    await db
      .update(workspaceMembers)
      .set({ role: parsed.data.role })
      .where(eq(workspaceMembers.id, params.memberId));

    await db.insert(activityLog).values({
      workspaceId: actor.workspaceId,
      actorId: user.id,
      eventType: "member_role_changed",
      entityId: params.memberId,
      entityType: "workspace_member",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[member-patch]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actor = await getActorMembership(user.id);
    if (!actor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!can(actor.wsType, actor.role, "member:remove")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [target] = await db
      .select({ role: workspaceMembers.role, workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, params.memberId), isNull(workspaceMembers.deletedAt)))
      .limit(1);

    if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (target.workspaceId !== actor.workspaceId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Guard: can't remove the last admin
    if (target.role === "admin") {
      const adminCount = await countAdmins(actor.workspaceId);
      if (adminCount <= 1) {
        return NextResponse.json({ error: "Cannot remove the last admin" }, { status: 400 });
      }
    }

    await db
      .update(workspaceMembers)
      .set({ deletedAt: new Date() })
      .where(eq(workspaceMembers.id, params.memberId));

    await db.insert(activityLog).values({
      workspaceId: actor.workspaceId,
      actorId: user.id,
      eventType: "member_removed",
      entityId: params.memberId,
      entityType: "workspace_member",
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[member-delete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

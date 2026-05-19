import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { invites, workspaceMembers, workspaces, users, activityLog } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";
import { sendInviteEmail } from "@/lib/email/send";
import { randomUUID } from "crypto";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
  note: z.string().max(500).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
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
      .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role, wsType: workspaces.type, wsName: workspaces.name })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(eq(users.id, user.id), isNull(workspaceMembers.deletedAt), isNull(workspaces.deletedAt)))
      .limit(1);

    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!can(membership.wsType, membership.role, "member:invite")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(invites).values({
      token,
      email: parsed.data.email,
      workspaceId: membership.workspaceId,
      role: parsed.data.role,
      invitedById: user.id,
      expiresAt,
    });

    await db.insert(activityLog).values({
      workspaceId: membership.workspaceId,
      actorId: user.id,
      eventType: "member_invited",
      entityId: membership.workspaceId,
      entityType: "workspace",
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviterName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
    await sendInviteEmail(parsed.data.email, {
      workspaceName: membership.wsName,
      workspaceType: membership.wsType,
      role: parsed.data.role,
      inviteUrl: `${appUrl}/invite/${token}`,
      inviterName,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[invites-post]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

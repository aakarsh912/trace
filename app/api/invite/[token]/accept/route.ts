import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { invites, users, workspaceMembers } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";

export async function POST(
  _req: NextRequest,
  { params }: { params: { token: string } }
): Promise<NextResponse> {
  const tag = `[invite/accept token=${params.token.slice(0, 8)}…]`;

  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      console.warn(`${tag} unauthenticated request`);
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Load the invite
    const [invite] = await db
      .select()
      .from(invites)
      .where(eq(invites.token, params.token))
      .limit(1);

    if (!invite) {
      console.warn(`${tag} token not found`);
      return NextResponse.json({ error: "Invalid invite" }, { status: 404 });
    }
    if (invite.acceptedAt) {
      console.warn(`${tag} already accepted at ${invite.acceptedAt.toISOString()}`);
      return NextResponse.json({ error: "Invite already used" }, { status: 409 });
    }
    if (invite.expiresAt < new Date()) {
      console.warn(`${tag} expired at ${invite.expiresAt.toISOString()}`);
      return NextResponse.json({ error: "Invite expired" }, { status: 410 });
    }

    // Get Clerk user details to upsert into our users table
    const clerkUser = await currentUser();
    if (!clerkUser) {
      console.error(`${tag} currentUser() returned null for clerkUserId=${clerkUserId}`);
      return NextResponse.json({ error: "Could not load user" }, { status: 500 });
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? invite.email;
    console.log(`${tag} accepting for clerkUserId=${clerkUserId} email=${email} workspaceId=${invite.workspaceId}`);

    // Upsert user in our DB
    const [dbUser] = await db
      .insert(users)
      .values({
        clerkUserId,
        email,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: { email, firstName: clerkUser.firstName, lastName: clerkUser.lastName },
      })
      .returning();

    if (!dbUser) {
      console.error(`${tag} user upsert returned no rows for clerkUserId=${clerkUserId}`);
      return NextResponse.json({ error: "Failed to upsert user" }, { status: 500 });
    }

    // Check if already a member (idempotent)
    const [existing] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invite.workspaceId),
          eq(workspaceMembers.userId, dbUser.id),
          isNull(workspaceMembers.deletedAt)
        )
      )
      .limit(1);

    if (!existing) {
      await db.insert(workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId: dbUser.id,
        role: invite.role,
      });
      console.log(`${tag} workspace_member created userId=${dbUser.id} role=${invite.role}`);
    } else {
      console.log(`${tag} user already a member, skipping insert`);
    }

    // Mark invite accepted
    await db
      .update(invites)
      .set({ acceptedAt: new Date() })
      .where(eq(invites.token, params.token));

    console.log(`${tag} invite accepted successfully`);
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

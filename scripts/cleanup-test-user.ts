/**
 * Dev-only cleanup script. Removes all DB and Clerk records for a test email
 * so the invite flow can be re-tested from scratch.
 *
 * Usage: npx tsx scripts/cleanup-test-user.ts <email>
 */

import { db } from "../lib/db/client";
import { users, workspaceMembers, invites } from "../lib/db/schema";
import { eq, sql } from "drizzle-orm";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npx tsx scripts/cleanup-test-user.ts <email>");
  process.exit(1);
}

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  console.error("CLERK_SECRET_KEY is not set");
  process.exit(1);
}

async function deleteClerkUser(clerkUserId: string): Promise<void> {
  const res = await fetch(`https://api.clerk.com/v1/users/${clerkUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Clerk DELETE failed (${res.status}): ${body}`);
  }
  console.log(`  ✓ Clerk account deleted (${clerkUserId})`);
}

async function main(): Promise<void> {
  console.log(`\nCleaning up test data for: ${email}\n`);

  // 1. Look up the user record
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email})`)
    .limit(1);

  if (!user) {
    console.log("No user record found in DB — checking invites only.\n");
  } else {
    console.log(`Found user: id=${user.id} clerkUserId=${user.clerkUserId}`);

    // 2. Delete workspace_members records
    const deleted = await db
      .delete(workspaceMembers)
      .where(eq(workspaceMembers.userId, user.id))
      .returning({ id: workspaceMembers.id });
    console.log(`  ✓ Removed ${deleted.length} workspace_member record(s)`);

    // 3. Delete user from our DB
    await db.delete(users).where(eq(users.id, user.id));
    console.log(`  ✓ Removed user record`);

    // 4. Delete Clerk account
    try {
      await deleteClerkUser(user.clerkUserId);
    } catch (err) {
      console.warn(`  ⚠ Could not delete Clerk account: ${(err as Error).message}`);
      console.warn(`    (Account may have already been deleted — continuing)`);
    }
  }

  // 5. Reset any invites for this email
  const reset = await db
    .update(invites)
    .set({ acceptedAt: null })
    .where(sql`lower(${invites.email}) = lower(${email})`)
    .returning({ id: invites.id, token: invites.token });

  if (reset.length > 0) {
    console.log(`  ✓ Reset accepted_at on ${reset.length} invite(s):`);
    reset.forEach((r) => console.log(`      invite id=${r.id}`));
  } else {
    console.log(`  — No invites found for this email`);
  }

  console.log("\nDone.\n");
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});

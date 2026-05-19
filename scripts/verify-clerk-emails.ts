import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users } from "../lib/db/schema";
import { inArray } from "drizzle-orm";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;

const SEED_EMAILS = [
  "arjun@hdfccapital.com",
  "kavya@hdfccapital.com",
  "priya@ramboll.com",
  "naveen@ramboll.com",
  "meera@eldeco.com",
  "rahul@eldeco.com",
];

type ClerkEmailAddress = { id: string; email_address: string; verification: { status: string } | null };
type ClerkUserDetail = { id: string; email_addresses: ClerkEmailAddress[] };

async function run(): Promise<void> {
  const dbUsers = await db
    .select({ email: users.email, clerkUserId: users.clerkUserId })
    .from(users)
    .where(inArray(users.email, SEED_EMAILS));

  console.log(`Verifying emails for ${dbUsers.length} users...\n`);

  for (const u of dbUsers) {
    // Get full user record from Clerk
    const res = await fetch(`https://api.clerk.com/v1/users/${u.clerkUserId}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    });
    const clerkUser = (await res.json()) as ClerkUserDetail;

    const emailObj = clerkUser.email_addresses.find(
      (e) => e.email_address === u.email
    );

    if (!emailObj) {
      console.error(`  ✗ ${u.email}: email address not found in Clerk`);
      continue;
    }

    if (emailObj.verification?.status === "verified") {
      console.log(`  ✓ ${u.email} already verified`);
      continue;
    }

    // Mark email as verified via admin API
    const verifyRes = await fetch(
      `https://api.clerk.com/v1/email_addresses/${emailObj.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${CLERK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ verified: true }),
      }
    );

    if (verifyRes.ok) {
      console.log(`  ✓ ${u.email} — verified`);
    } else {
      const err = await verifyRes.text();
      console.error(`  ✗ ${u.email}: ${err}`);
    }
  }

  console.log("\n✅ Done. Try logging in again at /login");
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

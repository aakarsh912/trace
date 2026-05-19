import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users } from "../lib/db/schema";
import { inArray } from "drizzle-orm";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;
const NEW_PASSWORD = "Tr@ce#Yamuna2026";

const SEED_EMAILS = [
  "arjun@hdfccapital.com",
  "kavya@hdfccapital.com",
  "priya@ramboll.com",
  "naveen@ramboll.com",
  "meera@eldeco.com",
  "rahul@eldeco.com",
];

async function run(): Promise<void> {
  const dbUsers = await db
    .select({ email: users.email, clerkUserId: users.clerkUserId })
    .from(users)
    .where(inArray(users.email, SEED_EMAILS));

  console.log(`Updating passwords for ${dbUsers.length} users...\n`);

  for (const u of dbUsers) {
    const res = await fetch(`https://api.clerk.com/v1/users/${u.clerkUserId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${CLERK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        password: NEW_PASSWORD,
        skip_password_checks: false,
      }),
    });

    if (res.ok) {
      console.log(`  ✓ ${u.email}`);
    } else {
      const err = await res.text();
      console.error(`  ✗ ${u.email}: ${err}`);
    }
  }

  console.log(`\n✅ All passwords updated to: ${NEW_PASSWORD}`);
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { users } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const neonSql = neon(process.env.DATABASE_URL!);
const db = drizzle(neonSql);

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY!;

type ClerkUser = {
  id: string;
  email_addresses: { email_address: string }[];
};

async function createClerkUser(
  email: string,
  password: string,
  firstName: string,
  lastName: string
): Promise<string> {
  // Check if user already exists in Clerk
  const searchRes = await fetch(
    `https://api.clerk.com/v1/users?email_address=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` } }
  );
  const existing = (await searchRes.json()) as ClerkUser[];
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`  ↩ ${email} already exists in Clerk (${existing[0]!.id})`);
    return existing[0]!.id;
  }

  const res = await fetch("https://api.clerk.com/v1/users", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CLERK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: [email],
      password,
      first_name: firstName,
      last_name: lastName,
      skip_password_checks: true,
      skip_password_requirement: false,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create ${email}: ${err}`);
  }

  const user = (await res.json()) as ClerkUser;
  console.log(`  ✓ Created ${email} → ${user.id}`);
  return user.id;
}

const TEST_USERS = [
  { email: "arjun@hdfccapital.com", password: "Test1234!", firstName: "Arjun", lastName: "Krishnan", seedId: "seed_arjun" },
  { email: "kavya@hdfccapital.com", password: "Test1234!", firstName: "Kavya", lastName: "Nair", seedId: "seed_kavya" },
  { email: "priya@ramboll.com", password: "Test1234!", firstName: "Priya", lastName: "Kapoor", seedId: "seed_priya" },
  { email: "naveen@ramboll.com", password: "Test1234!", firstName: "Naveen", lastName: "Rao", seedId: "seed_naveen" },
  { email: "meera@eldeco.com", password: "Test1234!", firstName: "Meera", lastName: "Sharma", seedId: "seed_meera" },
  { email: "rahul@eldeco.com", password: "Test1234!", firstName: "Rahul", lastName: "Verma", seedId: "seed_rahul" },
];

async function run(): Promise<void> {
  console.log("Creating Clerk users and syncing IDs to DB...\n");

  for (const u of TEST_USERS) {
    const clerkId = await createClerkUser(u.email, u.password, u.firstName, u.lastName);

    await db
      .update(users)
      .set({ clerkUserId: clerkId })
      .where(eq(users.clerkUserId, u.seedId));

    console.log(`  ↔ DB updated: ${u.seedId} → ${clerkId}`);
  }

  console.log("\n✅ Done. You can now log in with any seed user at /login");
  console.log("   Email: arjun@hdfccapital.com | Password: Test1234!  (Bank Admin)");
  console.log("   Email: priya@ramboll.com     | Password: Test1234!  (Consultant Admin)");
  console.log("   Email: meera@eldeco.com      | Password: Test1234!  (Loanee Admin)");
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

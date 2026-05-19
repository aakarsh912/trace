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

type PhoneNumber = { id: string; phone_number: string };
type ClerkUserDetail = {
  id: string;
  totp_enabled: boolean;
  backup_code_enabled: boolean;
  two_factor_enabled: boolean;
  phone_numbers: PhoneNumber[];
};

async function clerkDelete(path: string): Promise<boolean> {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
  });
  return res.ok;
}

async function run(): Promise<void> {
  const dbUsers = await db
    .select({ email: users.email, clerkUserId: users.clerkUserId })
    .from(users)
    .where(inArray(users.email, SEED_EMAILS));

  console.log(`Removing MFA from ${dbUsers.length} users...\n`);

  for (const u of dbUsers) {
    const res = await fetch(`https://api.clerk.com/v1/users/${u.clerkUserId}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    });
    const clerkUser = (await res.json()) as ClerkUserDetail;

    let removed = false;

    if (clerkUser.totp_enabled) {
      const ok = await clerkDelete(`/users/${u.clerkUserId}/totp`);
      if (ok) { console.log(`  ✓ ${u.email} — removed TOTP`); removed = true; }
    }

    if (clerkUser.backup_code_enabled) {
      const ok = await clerkDelete(`/users/${u.clerkUserId}/backup_code`);
      if (ok) { console.log(`  ✓ ${u.email} — removed backup codes`); removed = true; }
    }

    for (const phone of clerkUser.phone_numbers ?? []) {
      const ok = await clerkDelete(`/phone_numbers/${phone.id}`);
      if (ok) { console.log(`  ✓ ${u.email} — removed phone ${phone.phone_number}`); removed = true; }
    }

    if (!removed) {
      console.log(`  — ${u.email}: two_factor_enabled=${clerkUser.two_factor_enabled} (no factors to remove)`);
    }
  }

  console.log("\n✅ Done.");
  console.log("   If login still fails, the Clerk application has 'MFA required' set globally.");
  console.log("   Fix: Clerk Dashboard → Configure → User & Authentication → Multi-factor → set to Optional.");
}

run().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});

import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

type ClerkUserEvent = {
  type: "user.created" | "user.updated";
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    first_name: string | null;
    last_name: string | null;
  };
};

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  const headerPayload = headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await request.text();
  const wh = new Webhook(webhookSecret);

  let event: ClerkUserEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const email = event.data.email_addresses[0]?.email_address;
    if (!email) return NextResponse.json({ ok: true });

    await db
      .insert(users)
      .values({
        clerkUserId: event.data.id,
        email,
        firstName: event.data.first_name,
        lastName: event.data.last_name,
      })
      .onConflictDoUpdate({
        target: users.clerkUserId,
        set: {
          email,
          firstName: event.data.first_name,
          lastName: event.data.last_name,
        },
      });
  }

  return NextResponse.json({ ok: true });
}

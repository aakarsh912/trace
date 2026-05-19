import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { workspaces, invites } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ADMIN_COOKIE } from "@/lib/admin-auth";
import { sendInviteEmail } from "@/lib/email/send";
import { randomUUID } from "crypto";

const schema = z.object({
  name: z.string().min(1).max(100),
  adminEmail: z.string().email(),
});

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${base}-${Date.now().toString(36)}`;
}

function isAuthed(req: NextRequest): boolean {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;
  const cookie = req.cookies.get(ADMIN_COOKIE)?.value;
  return cookie === secret;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthed(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { name, adminEmail } = parsed.data;

  // Check for duplicate workspace name
  const [existing] = await db.select({ id: workspaces.id }).from(workspaces).where(eq(workspaces.name, name)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "A workspace with that name already exists" }, { status: 400 });
  }

  const slug = slugify(name);
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Create workspace
  const [workspace] = await db
    .insert(workspaces)
    .values({ name, slug, type: "bank" })
    .returning();

  if (!workspace) {
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }

  // Create invite
  await db.insert(invites).values({
    token,
    email: adminEmail,
    workspaceId: workspace.id,
    role: "admin",
    expiresAt,
  });

  await sendInviteEmail(adminEmail, {
    workspaceName: name,
    workspaceType: "bank",
    role: "admin",
    inviteUrl: `${appUrl}/invite/${token}`,
  });

  return NextResponse.json({ ok: true, workspaceId: workspace.id, token });
}

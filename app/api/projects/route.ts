import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { projects, workspaces, workspaceMembers, invites } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { sendInviteEmail } from "@/lib/email/send";
import { randomUUID } from "crypto";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  bankWorkspaceId: z.string().min(1),
  loaneeName: z.string().min(1).max(120),
  loaneeAdminEmail: z.string().email(),
  locationCity: z.string().max(80).optional(),
  locationState: z.string().max(80).optional(),
  constructionStartDate: z.string().optional(), // ISO date string from client
});

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
  return `${base}-${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const tag = "[api/projects]";
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Must be consultant admin
    const [membership] = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        wsType: workspaces.type,
        wsName: workspaces.name,
      })
      .from(workspaceMembers)
      .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
      .where(
        and(
          eq(workspaceMembers.userId, user.id),
          isNull(workspaceMembers.deletedAt),
          isNull(workspaces.deletedAt)
        )
      )
      .limit(1);

    if (!membership || membership.wsType !== "consultant" || membership.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
    }

    const {
      name,
      description,
      bankWorkspaceId,
      loaneeName,
      loaneeAdminEmail,
      locationCity,
      locationState,
      constructionStartDate,
    } = parsed.data;

    // Verify the bank workspace exists and is accessible to this consultant
    const [bankWs] = await db
      .select({ id: workspaces.id, name: workspaces.name })
      .from(workspaces)
      .where(and(eq(workspaces.id, bankWorkspaceId), eq(workspaces.type, "bank"), isNull(workspaces.deletedAt)))
      .limit(1);

    if (!bankWs) {
      return NextResponse.json({ error: "Bank workspace not found" }, { status: 400 });
    }

    // Check for duplicate project name within this consultant workspace
    const [dupProject] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.consultantWorkspaceId, membership.workspaceId), eq(projects.name, name), isNull(projects.deletedAt)))
      .limit(1);

    if (dupProject) {
      return NextResponse.json({ error: "A project with that name already exists" }, { status: 400 });
    }

    // 1. Create loanee workspace immediately
    const [loaneeWs] = await db
      .insert(workspaces)
      .values({ name: loaneeName, slug: slugify(loaneeName), type: "loanee" })
      .returning();

    if (!loaneeWs) {
      return NextResponse.json({ error: "Failed to create loanee workspace" }, { status: 500 });
    }

    // 2. Create project
    const constructionDate = constructionStartDate ? new Date(constructionStartDate) : null;

    const [project] = await db
      .insert(projects)
      .values({
        name,
        description: description ?? null,
        bankWorkspaceId,
        consultantWorkspaceId: membership.workspaceId,
        loaneeWorkspaceId: loaneeWs.id,
        locationCity: locationCity ?? null,
        locationState: locationState ?? null,
        constructionStartDate: constructionDate,
        createdById: user.id,
      })
      .returning();

    if (!project) {
      return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
    }

    // 3. Create invite for loanee admin
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(invites).values({
      token,
      email: loaneeAdminEmail,
      workspaceId: loaneeWs.id,
      role: "admin",
      invitedById: user.id,
      expiresAt,
    });

    // 4. Send invite email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviterName = [user.firstName, user.lastName].filter(Boolean).join(" ") || undefined;
    await sendInviteEmail(loaneeAdminEmail, {
      workspaceName: loaneeName,
      workspaceType: "loanee",
      role: "admin",
      inviteUrl: `${appUrl}/invite/${token}`,
      inviterName,
    });

    console.log(`${tag} project created id=${project.id} loaneeWs=${loaneeWs.id}`);
    return NextResponse.json({ projectId: project.id });

  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

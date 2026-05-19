import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { actions, deliverables, projects, workspaceMembers, workspaces } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";
import { getNextActionNumber } from "@/lib/db/helpers";

const deliverableSchema = z.object({
  description: z.string().min(1).max(500),
  documentHints: z.array(z.string().max(120)).max(10).optional(),
});

const schema = z.object({
  ifcCategory: z.enum(["regulatory", "ps1", "ps2", "ps3", "ps4", "ps6", "ps8", "c1"]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  targetDate: z.string().optional(),
  departmentHint: z.string().max(200).optional(),
  deliverables: z.array(deliverableSchema).min(1).max(26),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { projectId: string } }
): Promise<NextResponse> {
  const tag = `[api/projects/${params.projectId}/actions]`;
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get user's consultant workspace membership
    const [membership] = await db
      .select({
        workspaceId: workspaceMembers.workspaceId,
        role: workspaceMembers.role,
        wsType: workspaces.type,
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

    if (!membership || membership.wsType !== "consultant") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!can(membership.wsType, membership.role, "action:create")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify project belongs to this consultant workspace
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(
        and(
          eq(projects.id, params.projectId),
          eq(projects.consultantWorkspaceId, membership.workspaceId),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
    }

    const { ifcCategory, title, description, priority, targetDate, departmentHint, deliverables: deliverableInputs } = parsed.data;

    // Atomically get the next action number
    const actionNumber = await getNextActionNumber(params.projectId, ifcCategory);

    const [action] = await db
      .insert(actions)
      .values({
        projectId: params.projectId,
        actionNumber,
        ifcCategory,
        title,
        description: description ?? null,
        priority: priority ?? null,
        targetDate: targetDate ? new Date(targetDate) : null,
        departmentHint: departmentHint ?? null,
        createdById: user.id,
      })
      .returning();

    if (!action) {
      return NextResponse.json({ error: "Failed to create action" }, { status: 500 });
    }

    // Insert deliverables with sequential letters
    const letters = "abcdefghijklmnopqrstuvwxyz";
    for (let i = 0; i < deliverableInputs.length; i++) {
      const d = deliverableInputs[i]!;
      await db.insert(deliverables).values({
        actionId: action.id,
        letter: letters[i] ?? String(i + 1),
        description: d.description,
        documentHints: d.documentHints?.length ? JSON.stringify(d.documentHints) : null,
      });
    }

    console.log(`${tag} created action ${actionNumber} id=${action.id} with ${deliverableInputs.length} deliverable(s)`);
    return NextResponse.json({ actionId: action.id });

  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

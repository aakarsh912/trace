import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import {
  actions,
  deliverables,
  projects,
  workspaceMembers,
  workspaces,
  activityLog,
} from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";

// ─── Shared auth helper ───────────────────────────────────────────────────────

async function resolveConsultantAction(
  params: { projectId: string; actionId: string }
): Promise<{
  user: { id: string };
  membership: { workspaceId: string; role: "admin" | "member" };
  action: typeof actions.$inferSelect;
} | NextResponse> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [membership] = await db
    .select({ workspaceId: workspaceMembers.workspaceId, role: workspaceMembers.role, wsType: workspaces.type })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(and(eq(workspaceMembers.userId, user.id), isNull(workspaceMembers.deletedAt), isNull(workspaces.deletedAt)))
    .limit(1);

  if (!membership || membership.wsType !== "consultant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, params.projectId), eq(projects.consultantWorkspaceId, membership.workspaceId), isNull(projects.deletedAt)))
    .limit(1);

  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [action] = await db
    .select()
    .from(actions)
    .where(and(eq(actions.id, params.actionId), eq(actions.projectId, params.projectId), isNull(actions.deletedAt)))
    .limit(1);

  if (!action) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return { user, membership: { workspaceId: membership.workspaceId, role: membership.role }, action };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { projectId: string; actionId: string } }
): Promise<NextResponse> {
  const result = await resolveConsultantAction(params);
  if (result instanceof NextResponse) return result;
  const { action } = result;

  const delRows = await db
    .select({ id: deliverables.id, letter: deliverables.letter, description: deliverables.description, documentHints: deliverables.documentHints })
    .from(deliverables)
    .where(and(eq(deliverables.actionId, params.actionId), isNull(deliverables.deletedAt)));

  return NextResponse.json({
    id: action.id,
    ifcCategory: action.ifcCategory,
    title: action.title,
    description: action.description,
    priority: action.priority,
    targetDate: action.targetDate ? action.targetDate.toISOString().slice(0, 10) : null,
    departmentHint: action.departmentHint,
    estimatedCost: action.estimatedCost ?? null,
    deliverables: delRows.map((d) => ({
      id: d.id,
      letter: d.letter,
      description: d.description,
      documentHints: d.documentHints ? (JSON.parse(d.documentHints) as string[]) : null,
    })),
  });
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

const deliverableSchema = z.object({
  id: z.string().optional(),
  description: z.string().min(1).max(500),
  documentHints: z.array(z.string().max(120)).max(10).optional(),
});

const patchSchema = z.object({
  ifcCategory: z.enum(["regulatory", "c1", "ps1", "ps2", "ps3", "ps4", "ps5", "ps6", "ps7", "ps8"]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.enum(["critical", "high", "medium", "low"]).optional(),
  targetDate: z.string().optional(),
  departmentHint: z.string().max(200).optional(),
  estimatedCost: z.string().max(100).nullable().optional(),
  deliverables: z.array(deliverableSchema).min(1).max(26),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { projectId: string; actionId: string } }
): Promise<NextResponse> {
  const tag = `[api/actions/${params.actionId}/patch]`;
  try {
    const result = await resolveConsultantAction(params);
    if (result instanceof NextResponse) return result;
    const { user, membership } = result;

    if (!can("consultant", membership.role, "action:edit")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
    }

    const { ifcCategory, title, description, priority, targetDate, departmentHint, estimatedCost, deliverables: deliverableInputs } = parsed.data;

    // Update action fields
    await db
      .update(actions)
      .set({
        ifcCategory,
        title,
        description: description ?? null,
        priority: priority ?? null,
        targetDate: targetDate ? new Date(targetDate) : null,
        departmentHint: departmentHint ?? null,
        estimatedCost: estimatedCost ?? null,
      })
      .where(eq(actions.id, params.actionId));

    // Reconcile deliverables
    const existing = await db
      .select({ id: deliverables.id, letter: deliverables.letter })
      .from(deliverables)
      .where(and(eq(deliverables.actionId, params.actionId), isNull(deliverables.deletedAt)));

    // All deliverables ever (incl. soft-deleted) to determine next letter
    const allLetters = await db
      .select({ letter: deliverables.letter })
      .from(deliverables)
      .where(eq(deliverables.actionId, params.actionId));

    const maxLetterCode = allLetters.reduce((max, d) => Math.max(max, d.letter.charCodeAt(0)), 96);

    const incomingIds = new Set(deliverableInputs.filter((d) => d.id).map((d) => d.id!));

    // Soft-delete deliverables removed from the form
    const toDelete = existing.filter((d) => !incomingIds.has(d.id));
    for (const d of toDelete) {
      await db.update(deliverables).set({ deletedAt: new Date() }).where(eq(deliverables.id, d.id));
    }

    // Update existing deliverables
    for (const d of deliverableInputs.filter((d) => d.id)) {
      await db
        .update(deliverables)
        .set({
          description: d.description,
          documentHints: d.documentHints?.length ? JSON.stringify(d.documentHints) : null,
        })
        .where(eq(deliverables.id, d.id!));
    }

    // Insert new deliverables
    const newDeliverables = deliverableInputs.filter((d) => !d.id);
    for (let i = 0; i < newDeliverables.length; i++) {
      const d = newDeliverables[i]!;
      await db.insert(deliverables).values({
        actionId: params.actionId,
        letter: String.fromCharCode(maxLetterCode + 1 + i),
        description: d.description,
        documentHints: d.documentHints?.length ? JSON.stringify(d.documentHints) : null,
      });
    }

    // Activity log
    await db.insert(activityLog).values({
      workspaceId: membership.workspaceId,
      projectId: params.projectId,
      actorId: user.id,
      eventType: "action.edited",
      entityId: params.actionId,
      entityType: "action",
      metadata: JSON.stringify({ title }),
    });

    console.log(`${tag} updated action id=${params.actionId}`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(`${tag} unhandled error:`, err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

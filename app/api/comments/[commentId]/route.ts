import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { comments } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/clerk";

const editSchema = z.object({
  body: z.string().min(1).max(2000),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { commentId: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const parsed = editSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 }
      );
    }

    const [comment] = await db
      .select({ authorId: comments.authorId, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, params.commentId))
      .limit(1);

    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (comment.deletedAt) return NextResponse.json({ error: "Comment is deleted" }, { status: 400 });
    if (comment.authorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await db
      .update(comments)
      .set({ body: parsed.data.body, editedAt: new Date() })
      .where(eq(comments.id, params.commentId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-patch]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { commentId: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [comment] = await db
      .select({ authorId: comments.authorId, deletedAt: comments.deletedAt })
      .from(comments)
      .where(eq(comments.id, params.commentId))
      .limit(1);

    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (comment.deletedAt) return NextResponse.json({ ok: true }); // idempotent
    if (comment.authorId !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    await db
      .update(comments)
      .set({ deletedAt: new Date() })
      .where(eq(comments.id, params.commentId));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[comment-delete]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

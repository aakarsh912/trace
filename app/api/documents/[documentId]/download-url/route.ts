import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { documents, deliverables, actions, projects } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser, getUserWorkspaces } from "@/lib/auth/clerk";
import { getSignedDownloadUrl } from "@/lib/storage/r2";

export async function GET(
  _req: NextRequest,
  { params }: { params: { documentId: string } }
): Promise<NextResponse> {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userWorkspaces = await getUserWorkspaces(user.id);

    const [row] = await db
      .select({
        fileKey: documents.fileKey,
        bankWorkspaceId: projects.bankWorkspaceId,
        consultantWorkspaceId: projects.consultantWorkspaceId,
        loaneeWorkspaceId: projects.loaneeWorkspaceId,
      })
      .from(documents)
      .innerJoin(deliverables, eq(documents.deliverableId, deliverables.id))
      .innerJoin(actions, eq(deliverables.actionId, actions.id))
      .innerJoin(projects, eq(actions.projectId, projects.id))
      .where(
        and(
          eq(documents.id, params.documentId),
          isNull(documents.deletedAt),
          isNull(deliverables.deletedAt),
          isNull(actions.deletedAt),
          isNull(projects.deletedAt)
        )
      )
      .limit(1);

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const projectWsIds = new Set([
      row.bankWorkspaceId,
      row.consultantWorkspaceId,
      row.loaneeWorkspaceId,
    ]);

    const hasAccess = userWorkspaces.some((w) => projectWsIds.has(w.workspaceId));
    if (!hasAccess) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const url = await getSignedDownloadUrl(row.fileKey);
    return NextResponse.json({ url });
  } catch (err) {
    console.error("[download-url]", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

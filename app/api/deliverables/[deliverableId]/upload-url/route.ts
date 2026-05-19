import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { deliverables, actions, projects } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getCurrentUser, getUserWorkspaces } from "@/lib/auth/clerk";
import { can } from "@/lib/auth/permissions";
import { getUploadUrl, generateFileKey } from "@/lib/storage/r2";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const schema = z.object({
  fileName: z.string().min(1).max(255),
  fileSize: z.number().int().positive(),
  mimeType: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { deliverableId: string } }
): Promise<NextResponse> {
  try {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userWorkspaces = await getUserWorkspaces(user.id);
  const ws = userWorkspaces.find((w) => w.workspaceType === "loanee");
  if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (!can(ws.workspaceType, ws.role, "document:upload")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { fileName, fileSize, mimeType } = parsed.data;

  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File exceeds the 25 MB limit" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      {
        error:
          "File type not allowed. Accepted: PDF, DOC, DOCX, XLS, XLSX, PNG, JPG, ZIP",
      },
      { status: 400 }
    );
  }

  const [row] = await db
    .select({
      status: deliverables.status,
      projectId: projects.id,
      loaneeWorkspaceId: projects.loaneeWorkspaceId,
    })
    .from(deliverables)
    .innerJoin(actions, eq(deliverables.actionId, actions.id))
    .innerJoin(projects, eq(actions.projectId, projects.id))
    .where(
      and(
        eq(deliverables.id, params.deliverableId),
        isNull(deliverables.deletedAt),
        isNull(actions.deletedAt),
        isNull(projects.deletedAt)
      )
    )
    .limit(1);

  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (row.loaneeWorkspaceId !== ws.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (row.status === "approved") {
    return NextResponse.json(
      { error: "This deliverable is approved and locked" },
      { status: 400 }
    );
  }

  const fileKey = generateFileKey(row.projectId, params.deliverableId, fileName);
  const uploadUrl = await getUploadUrl(fileKey, mimeType);

  return NextResponse.json({ uploadUrl, fileKey });
  } catch (err) {
    console.error("[upload-url]", err);
    const message =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? err.message
        : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

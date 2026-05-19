import { db } from "@/lib/db/client";
import { invites, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { InviteAccept } from "@/components/invite/invite-accept";
import type { WorkspaceType, WorkspaceMemberRole } from "@/lib/db/schema";

type InviteState =
  | { status: "invalid" }
  | { status: "expired" }
  | { status: "accepted" }
  | {
      status: "valid";
      token: string;
      workspaceName: string;
      workspaceType: WorkspaceType;
      role: WorkspaceMemberRole;
      email: string;
    };

async function resolveInvite(token: string): Promise<InviteState> {
  const [row] = await db
    .select({
      id: invites.id,
      email: invites.email,
      role: invites.role,
      expiresAt: invites.expiresAt,
      acceptedAt: invites.acceptedAt,
      workspaceName: workspaces.name,
      workspaceType: workspaces.type,
    })
    .from(invites)
    .innerJoin(workspaces, eq(invites.workspaceId, workspaces.id))
    .where(eq(invites.token, token))
    .limit(1);

  if (!row) return { status: "invalid" };
  if (row.acceptedAt) return { status: "accepted" };
  if (row.expiresAt < new Date()) return { status: "expired" };

  return {
    status: "valid",
    token,
    workspaceName: row.workspaceName,
    workspaceType: row.workspaceType,
    role: row.role,
    email: row.email,
  };
}

function ErrorCard({ title, message }: { title: string; message: string }): JSX.Element {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: 32, width: "100%", maxWidth: 420, boxShadow: "0 1px 4px rgba(0,0,0,0.06)", textAlign: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 18 }}>✕</div>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{title}</div>
        <p style={{ fontSize: 13, color: "#666", margin: 0 }}>{message}</p>
        <a href="/login" style={{ display: "inline-block", marginTop: 20, fontSize: 13, color: "#0A0A0A", fontWeight: 500 }}>Go to login →</a>
      </div>
    </div>
  );
}

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}): Promise<JSX.Element> {
  const state = await resolveInvite(params.token);

  if (state.status === "invalid") {
    return <ErrorCard title="Invalid invite link" message="This invite link doesn't exist or has been removed." />;
  }
  if (state.status === "expired") {
    return <ErrorCard title="Invite has expired" message="This invite link expired after 7 days. Ask your workspace admin to send a new one." />;
  }
  if (state.status === "accepted") {
    return <ErrorCard title="Invite already used" message="This invite link has already been accepted. Try logging in to your account." />;
  }

  return (
    <InviteAccept
      token={state.token}
      workspaceName={state.workspaceName}
      workspaceType={state.workspaceType}
      role={state.role}
      email={state.email}
    />
  );
}

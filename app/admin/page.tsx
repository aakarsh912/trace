import { redirect } from "next/navigation";
import { isAdminAuthed } from "@/lib/admin-auth";
import { db } from "@/lib/db/client";
import { workspaces, workspaceMembers } from "@/lib/db/schema";
import { eq, isNull, count, and } from "drizzle-orm";
import type { WorkspaceType } from "@/lib/db/schema";
import { CreateWorkspaceForm } from "./_components/create-workspace-form";

const TYPE_LABEL: Record<WorkspaceType, string> = {
  bank: "Bank",
  consultant: "Consultant",
  loanee: "Loanee",
};

const TYPE_COLOR: Record<WorkspaceType, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

async function getAllWorkspaces() {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      type: workspaces.type,
      createdAt: workspaces.createdAt,
      memberCount: count(workspaceMembers.id),
    })
    .from(workspaces)
    .leftJoin(
      workspaceMembers,
      and(
        eq(workspaceMembers.workspaceId, workspaces.id),
        isNull(workspaceMembers.deletedAt)
      )
    )
    .where(isNull(workspaces.deletedAt))
    .groupBy(workspaces.id, workspaces.name, workspaces.type, workspaces.createdAt)
    .orderBy(workspaces.createdAt);

  return rows;
}

export default async function AdminPage(): Promise<JSX.Element> {
  if (!isAdminAuthed()) redirect("/admin/login");

  const allWorkspaces = await getAllWorkspaces();

  const byType = {
    bank: allWorkspaces.filter((w) => w.type === "bank"),
    consultant: allWorkspaces.filter((w) => w.type === "consultant"),
    loanee: allWorkspaces.filter((w) => w.type === "loanee"),
  };

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 14, color: "#111", minHeight: "100vh", background: "#f9f9f9" }}>
      {/* Header */}
      <div style={{ background: "#0A0A0A", color: "white", padding: "14px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>Trace · Admin</span>
        <a href="/api/admin/logout" style={{ fontSize: 12, color: "#aaa", textDecoration: "none" }}>Sign out</a>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "32px 24px" }}>

        {/* Stats row */}
        <div style={{ display: "flex", gap: 16, marginBottom: 32 }}>
          {(["bank", "consultant", "loanee"] as WorkspaceType[]).map((type) => (
            <div key={type} style={{ flex: 1, background: "white", border: "1px solid #e5e5e5", borderRadius: 8, padding: "16px 20px" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>{TYPE_LABEL[type]}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: TYPE_COLOR[type] }}>{byType[type].length}</div>
              <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>workspace{byType[type].length !== 1 ? "s" : ""}</div>
            </div>
          ))}
        </div>

        {/* Workspace table */}
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, marginBottom: 32, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e5e5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>All Workspaces</span>
            <span style={{ fontSize: 12, color: "#888" }}>{allWorkspaces.length} total</span>
          </div>
          {allWorkspaces.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "#888", fontSize: 13 }}>No workspaces yet.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#fafafa" }}>
                  {["Name", "Type", "Created", "Members", "Status"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "9px 16px", fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: "1px solid #e5e5e5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allWorkspaces.map((ws) => {
                  const isActive = ws.memberCount > 0;
                  return (
                    <tr key={ws.id} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "11px 16px", fontWeight: 500 }}>{ws.name}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: TYPE_COLOR[ws.type] + "18", color: TYPE_COLOR[ws.type] }}>
                          {TYPE_LABEL[ws.type]}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", color: "#666" }}>{formatDate(ws.createdAt)}</td>
                      <td style={{ padding: "11px 16px", color: "#666" }}>{ws.memberCount}</td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600, background: isActive ? "#dcfce7" : "#fef9c3", color: isActive ? "#166534" : "#854d0e" }}>
                          {isActive ? "Active" : "Pending"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Create Bank Workspace */}
        <div style={{ background: "white", border: "1px solid #e5e5e5", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e5e5" }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Create Bank Workspace</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
              Creates the workspace and sends an admin invite email. Only bank workspaces are created here — consultants and loanees are invited through the app.
            </div>
          </div>
          <div style={{ padding: "20px" }}>
            <CreateWorkspaceForm />
          </div>
        </div>

      </div>
    </div>
  );
}

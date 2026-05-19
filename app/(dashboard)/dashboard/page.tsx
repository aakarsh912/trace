import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db/client";
import {
  users,
  workspaceMembers,
  workspaces,
  projects,
  actions,
  deliverables,
} from "@/lib/db/schema";
import { eq, and, isNull, count, sql } from "drizzle-orm";
import type { WorkspaceType } from "@/lib/db/schema";
import { getAllWorkspacesForClerkUser, resolveActiveWorkspace } from "@/lib/auth/active-workspace";

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkspaceCtx = {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  workspaceType: WorkspaceType;
  firstName: string;
};

type ProjectStats = {
  id: string;
  name: string;
  totalActions: number;
  approvedCount: number;
  submittedCount: number;
  sentBackCount: number;
  pendingCount: number;
  loaneeWorkspaceName: string;
  consultantWorkspaceName: string;
  bankWorkspaceName: string;
};

type SubmittedDeliverable = {
  deliverableId: string;
  letter: string;
  description: string;
  actionNumber: string;
  actionTitle: string;
  projectName: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function progressBar(stats: ProjectStats): JSX.Element {
  const total = stats.approvedCount + stats.submittedCount + stats.sentBackCount + stats.pendingCount;
  if (total === 0) return <div style={{ height: 4, background: "var(--bg-subtle)", borderRadius: 2 }} />;
  const ap = (stats.approvedCount / total) * 100;
  const su = (stats.submittedCount / total) * 100;
  const sb = (stats.sentBackCount / total) * 100;
  return (
    <div style={{ height: 4, background: "var(--bg-subtle)", borderRadius: 2, overflow: "hidden", display: "flex" }}>
      <div style={{ width: `${ap}%`, background: "var(--status-approved-fg)", height: "100%" }} />
      <div style={{ width: `${su}%`, background: "var(--status-submitted-fg)", height: "100%" }} />
      <div style={{ width: `${sb}%`, background: "var(--status-returned-fg)", height: "100%" }} />
    </div>
  );
}

function projectInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function getContext(): Promise<WorkspaceCtx | null> {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const allWorkspaces = await getAllWorkspacesForClerkUser(clerkId);
  const activeId = cookies().get("active_workspace")?.value;
  const active = resolveActiveWorkspace(allWorkspaces, activeId);
  if (!active) return null;

  const rows = await db
    .select({ userId: users.id, firstName: users.firstName })
    .from(users)
    .where(and(eq(users.clerkUserId, clerkId), isNull(users.deletedAt)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.userId,
    workspaceId: active.id,
    workspaceName: active.name,
    workspaceType: active.type,
    firstName: row.firstName ?? "there",
  };
}

const bankWs = workspaces;
const consultantWs = workspaces;
const loaneeWs = workspaces;

async function getProjectsWithStats(
  wsId: string,
  wsType: WorkspaceType
): Promise<ProjectStats[]> {
  const col =
    wsType === "bank"
      ? projects.bankWorkspaceId
      : wsType === "consultant"
      ? projects.consultantWorkspaceId
      : projects.loaneeWorkspaceId;

  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      bankWorkspaceId: projects.bankWorkspaceId,
      consultantWorkspaceId: projects.consultantWorkspaceId,
      loaneeWorkspaceId: projects.loaneeWorkspaceId,
    })
    .from(projects)
    .where(and(eq(col, wsId), isNull(projects.deletedAt)));

  if (projectRows.length === 0) return [];

  const stats: ProjectStats[] = [];

  for (const p of projectRows) {
    const [bWs, cWs, lWs] = await Promise.all([
      db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, p.bankWorkspaceId)).limit(1),
      db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, p.consultantWorkspaceId)).limit(1),
      db.select({ name: workspaces.name }).from(workspaces).where(eq(workspaces.id, p.loaneeWorkspaceId)).limit(1),
    ]);

    const actionRows = await db
      .select({ id: actions.id })
      .from(actions)
      .where(and(eq(actions.projectId, p.id), isNull(actions.deletedAt)));

    const actionIds = actionRows.map((a) => a.id);

    let approvedCount = 0, submittedCount = 0, sentBackCount = 0, pendingCount = 0;

    if (actionIds.length > 0) {
      const counts = await db
        .select({
          status: deliverables.status,
          cnt: count(),
        })
        .from(deliverables)
        .where(
          and(
            sql`${deliverables.actionId} = ANY(${sql.raw(`ARRAY[${actionIds.map((id) => `'${id}'`).join(",")}]::text[]`)})`,
            isNull(deliverables.deletedAt)
          )
        )
        .groupBy(deliverables.status);

      for (const row of counts) {
        if (row.status === "approved") approvedCount = Number(row.cnt);
        else if (row.status === "submitted") submittedCount = Number(row.cnt);
        else if (row.status === "sent_back") sentBackCount = Number(row.cnt);
        else pendingCount += Number(row.cnt);
      }
    }

    stats.push({
      id: p.id,
      name: p.name,
      totalActions: actionIds.length,
      approvedCount,
      submittedCount,
      sentBackCount,
      pendingCount,
      bankWorkspaceName: bWs[0]?.name ?? "",
      consultantWorkspaceName: cWs[0]?.name ?? "",
      loaneeWorkspaceName: lWs[0]?.name ?? "",
    });
  }

  return stats;
}

async function getSubmittedDeliverables(wsId: string): Promise<SubmittedDeliverable[]> {
  const rows = await db
    .select({
      deliverableId: deliverables.id,
      letter: deliverables.letter,
      description: deliverables.description,
      actionNumber: actions.actionNumber,
      actionTitle: actions.title,
      projectName: projects.name,
    })
    .from(deliverables)
    .innerJoin(actions, eq(deliverables.actionId, actions.id))
    .innerJoin(projects, eq(actions.projectId, projects.id))
    .where(
      and(
        eq(deliverables.status, "submitted"),
        eq(projects.consultantWorkspaceId, wsId),
        isNull(deliverables.deletedAt),
        isNull(actions.deletedAt),
        isNull(projects.deletedAt)
      )
    )
    .limit(5);

  return rows;
}

async function getSentBackDeliverables(wsId: string): Promise<SubmittedDeliverable[]> {
  const rows = await db
    .select({
      deliverableId: deliverables.id,
      letter: deliverables.letter,
      description: deliverables.description,
      actionNumber: actions.actionNumber,
      actionTitle: actions.title,
      projectName: projects.name,
    })
    .from(deliverables)
    .innerJoin(actions, eq(deliverables.actionId, actions.id))
    .innerJoin(projects, eq(actions.projectId, projects.id))
    .where(
      and(
        eq(deliverables.status, "sent_back"),
        eq(projects.loaneeWorkspaceId, wsId),
        isNull(deliverables.deletedAt),
        isNull(actions.deletedAt),
        isNull(projects.deletedAt)
      )
    )
    .limit(5);

  return rows;
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  valueColor,
}: {
  label: string;
  value: number;
  sub: string;
  valueColor?: string;
}): JSX.Element {
  return (
    <div style={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px" }}>
      <div style={{ fontSize: 11, color: "var(--fg-tertiary)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums", color: valueColor ?? "var(--fg)" }}>
        {value}
      </div>
      <div style={{ fontSize: 11.5, color: "var(--fg-tertiary)", marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function SectionHeader({ title, linkLabel, linkHref }: { title: string; linkLabel?: string; linkHref?: string }): JSX.Element {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg)" }}>{title}</span>
      {linkLabel && linkHref && (
        <Link href={linkHref} style={{ fontSize: 12, color: "var(--fg-tertiary)", textDecoration: "none" }}>
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

function Chip({ label, variant }: { label: string; variant: "submitted" | "returned" | "approved" | "progress" }): JSX.Element {
  const styles = {
    submitted: { bg: "var(--status-submitted-bg)", fg: "var(--status-submitted-fg)" },
    returned: { bg: "var(--status-returned-bg)", fg: "var(--status-returned-fg)" },
    approved: { bg: "var(--status-approved-bg)", fg: "var(--status-approved-fg)" },
    progress: { bg: "var(--status-progress-bg)", fg: "var(--status-progress-fg)" },
  };
  const s = styles[variant];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", borderRadius: 4, fontSize: 11.5, fontWeight: 500, background: s.bg, color: s.fg, whiteSpace: "nowrap" }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
      {label}
    </span>
  );
}

function EmptyFeed(): JSX.Element {
  return (
    <div style={{ paddingTop: 16, fontSize: 12, color: "var(--fg-tertiary)", textAlign: "center" }}>
      No recent activity yet.
    </div>
  );
}

// ─── Persona dashboards ───────────────────────────────────────────────────────

function ConsultantDashboard({ ctx, projectStats, submitted }: {
  ctx: WorkspaceCtx;
  projectStats: ProjectStats[];
  submitted: SubmittedDeliverable[];
}): JSX.Element {
  const sentBackCount = projectStats.reduce((s, p) => s + p.sentBackCount, 0);
  const submittedCount = projectStats.reduce((s, p) => s + p.submittedCount, 0);
  const approvedCount = projectStats.reduce((s, p) => s + p.approvedCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", minHeight: "calc(100vh - 48px)" }}>
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, padding: "28px 32px", borderRight: "1px solid var(--border)" }}>
        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 4px" }}>
            {getGreeting()}, {ctx.firstName}.
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--fg-secondary)", margin: 0 }}>
            {sentBackCount > 0 ? (
              <>You have <strong style={{ color: "var(--status-returned-fg)" }}>{sentBackCount} Action{sentBackCount !== 1 ? "s" : ""} returned</strong> needing your clarification.</>
            ) : submittedCount > 0 ? (
              <>You have <strong style={{ color: "var(--status-submitted-fg)" }}>{submittedCount} deliverable{submittedCount !== 1 ? "s" : ""}</strong> awaiting your review.</>
            ) : (
              <>Everything is on track across your projects.</>
            )}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
          <StatCard label="Active Projects" value={projectStats.length} sub={`Across ${projectStats.length} loanee${projectStats.length !== 1 ? "s" : ""}`} />
          <StatCard label="Awaiting your review" value={submittedCount} sub="Submitted by loanees" valueColor={submittedCount > 0 ? "var(--status-submitted-fg)" : undefined} />
          <StatCard label="Sent back to loanees" value={sentBackCount} sub="Awaiting their revision" valueColor={sentBackCount > 0 ? "var(--status-returned-fg)" : undefined} />
          <StatCard label="Approved this month" value={approvedCount} sub="Across all projects" />
        </div>

        {/* Awaiting review */}
        {submitted.length > 0 && (
          <>
            <SectionHeader title="Awaiting your review" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 32 }}>
              {submitted.map((d) => (
                <Link key={d.deliverableId} href={`/projects`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#FFFCF7", border: "1px solid #E8D0A8", borderRadius: "var(--radius)", fontSize: 12.5, textDecoration: "none", color: "inherit" }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--status-returned-fg)", flexShrink: 0, width: 36 }}>{d.actionNumber}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--fg)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.actionTitle}</div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-tertiary)", marginTop: 2 }}>{d.projectName} · deliverable ({d.letter.toLowerCase()})</div>
                  </div>
                  <Chip label="Submitted" variant="submitted" />
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Projects */}
        <SectionHeader title="Your projects" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {projectStats.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: "var(--radius-lg)", fontSize: 13, color: "var(--fg-tertiary)" }}>
              No projects yet. Create your first project to get started.
            </div>
          ) : (
            projectStats.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px",
                background: p.sentBackCount > 0 ? "#FFFCF7" : "var(--bg-surface)",
                border: `1px solid ${p.sentBackCount > 0 ? "#E8D0A8" : "var(--border)"}`,
                borderRadius: "var(--radius-lg)",
                textDecoration: "none", color: "inherit", transition: "border-color 80ms",
              }}>
                <div style={{ width: 32, height: 32, borderRadius: "var(--radius)", background: "var(--bg-subtle)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: "var(--fg-secondary)", fontFamily: "ui-monospace, monospace" }}>
                  {projectInitials(p.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-tertiary)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span>{p.loaneeWorkspaceName}</span><span>·</span>
                    <span>{p.bankWorkspaceName}</span>
                    {p.sentBackCount > 0 && <><span>·</span><span style={{ color: "var(--status-returned-fg)" }}>{p.sentBackCount} returned</span></>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--fg-secondary)" }}>
                    <div style={{ width: 80 }}>{progressBar(p)}</div>
                    <span>{p.approvedCount} / {p.totalActions}</span>
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Aside */}
      <div style={{ width: 280, flexShrink: 0, padding: "24px 20px", background: "var(--bg)", position: "sticky", top: 48 }}>
        <SectionHeader title="Recent activity" />
        <EmptyFeed />
      </div>
    </div>
  );
}

function BankDashboard({ ctx, projectStats }: { ctx: WorkspaceCtx; projectStats: ProjectStats[] }): JSX.Element {
  const submittedCount = projectStats.reduce((s, p) => s + p.submittedCount, 0);
  const sentBackCount = projectStats.reduce((s, p) => s + p.sentBackCount, 0);
  const approvedCount = projectStats.reduce((s, p) => s + p.approvedCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", minHeight: "calc(100vh - 48px)" }}>
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, padding: "28px 32px", borderRight: "1px solid var(--border)" }}>
        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
          <StatCard label="Active Projects" value={projectStats.length} sub="In your portfolio" />
          <StatCard label="Submitted to consultant" value={submittedCount} sub="Across all projects" valueColor={submittedCount > 0 ? "var(--status-submitted-fg)" : undefined} />
          <StatCard label="Sent back" value={sentBackCount} sub="Awaiting revision" valueColor={sentBackCount > 0 ? "var(--status-returned-fg)" : undefined} />
          <StatCard label="Approved this month" value={approvedCount} sub="Across all projects" />
        </div>

        {/* Projects */}
        <SectionHeader title="Projects" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {projectStats.length === 0 ? (
            <div style={{ padding: "32px 16px", textAlign: "center", border: "1px dashed var(--border)", borderRadius: "var(--radius-lg)", fontSize: 13, color: "var(--fg-tertiary)" }}>
              No projects yet.
            </div>
          ) : (
            projectStats.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} style={{
                display: "block",
                background: p.sentBackCount > 0 ? "#FFFCF7" : "var(--bg-surface)",
                border: `1px solid ${p.sentBackCount > 0 ? "#E8D0A8" : "var(--border)"}`,
                borderRadius: "var(--radius-lg)", padding: "16px 18px",
                textDecoration: "none", color: "inherit",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>{p.name}</div>
                  {p.sentBackCount > 0 && <Chip label="Needs attention" variant="returned" />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 12, color: "var(--fg-secondary)", marginBottom: 10 }}>
                  <span style={{ fontSize: 11, color: "var(--fg-tertiary)", background: "var(--bg-subtle)", padding: "1px 5px", borderRadius: 3 }}>Consultant</span>
                  <strong style={{ color: "var(--fg)" }}>{p.consultantWorkspaceName}</strong>
                  <span style={{ color: "var(--fg-tertiary)" }}>·</span>
                  <span style={{ color: "var(--fg-tertiary)" }}>{p.loaneeWorkspaceName}</span>
                </div>
                {progressBar(p)}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--fg-tertiary)" }}>
                  <span style={{ color: "var(--status-approved-fg)", fontWeight: 500 }}>{p.approvedCount} approved</span>
                  <span>·</span>
                  <span style={{ color: "var(--status-submitted-fg)" }}>{p.submittedCount} submitted</span>
                  <span>·</span>
                  <span>{p.pendingCount} pending</span>
                  <span style={{ marginLeft: "auto" }}>{p.totalActions} Actions total</span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* Aside */}
      <div style={{ width: 280, flexShrink: 0, padding: "24px 20px", background: "var(--bg)", position: "sticky", top: 48 }}>
        <SectionHeader title="Activity" />
        <EmptyFeed />
      </div>
    </div>
  );
}

function LoaneeDashboard({ ctx, projectStats, sentBack }: {
  ctx: WorkspaceCtx;
  projectStats: ProjectStats[];
  sentBack: SubmittedDeliverable[];
}): JSX.Element {
  const totalActions = projectStats.reduce((s, p) => s + p.totalActions, 0);
  const inProgress = projectStats.reduce((s, p) => s + p.pendingCount, 0);
  const returned = projectStats.reduce((s, p) => s + p.sentBackCount, 0);
  const submitted = projectStats.reduce((s, p) => s + p.submittedCount, 0);

  return (
    <div style={{ display: "flex", flexDirection: "row", alignItems: "flex-start", minHeight: "calc(100vh - 48px)" }}>
      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, padding: "28px 32px", borderRight: "1px solid var(--border)" }}>
        {/* Greeting */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.015em", margin: "0 0 4px" }}>
            {getGreeting()}, {ctx.firstName}.
          </h1>
          <p style={{ fontSize: 13.5, color: "var(--fg-secondary)", margin: 0 }}>
            {returned > 0 && <><strong style={{ color: "var(--status-returned-fg)" }}>{returned} Action{returned !== 1 ? "s" : ""} returned</strong> needing new evidence. </>}
            {submitted > 0 && <><strong style={{ color: "var(--fg)" }}>{submitted} submitted</strong> awaiting consultant review.</>}
            {returned === 0 && submitted === 0 && <>Keep up the good work on your projects.</>}
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 32 }}>
          <StatCard label="Total Actions" value={totalActions} sub="Across all projects" />
          <StatCard label="In progress" value={inProgress} sub="Being worked on" valueColor={inProgress > 0 ? "var(--status-progress-fg)" : undefined} />
          <StatCard label="Returned" value={returned} sub="Needs new evidence" valueColor={returned > 0 ? "var(--status-returned-fg)" : undefined} />
          <StatCard label="Submitted" value={submitted} sub="Awaiting review" valueColor={submitted > 0 ? "var(--status-submitted-fg)" : undefined} />
        </div>

        {/* Projects */}
        <SectionHeader title="Active projects" linkLabel="All projects →" linkHref="/projects" />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 32 }}>
          {projectStats.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} style={{
              display: "block",
              background: p.sentBackCount > 0 ? "#FFFCF7" : "var(--bg-surface)",
              border: `1px solid ${p.sentBackCount > 0 ? "#E8D0A8" : "var(--border)"}`,
              borderRadius: "var(--radius-lg)", padding: "16px 18px",
              textDecoration: "none", color: "inherit",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 3 }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "var(--fg-tertiary)" }}>{p.loaneeWorkspaceName} · {p.consultantWorkspaceName} · {p.bankWorkspaceName}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8, marginBottom: 12 }}>
                {[
                  { val: p.pendingCount, label: "Action Items", color: "var(--status-todo-fg)", bg: "var(--status-todo-bg)" },
                  { val: p.pendingCount, label: "In Progress", color: "var(--status-progress-fg)", bg: "var(--status-progress-bg)" },
                  { val: p.submittedCount, label: "Submitted", color: "var(--status-submitted-fg)", bg: "var(--status-submitted-bg)" },
                  { val: p.sentBackCount, label: "Returned", color: "var(--status-returned-fg)", bg: "var(--status-returned-bg)" },
                  { val: p.approvedCount, label: "Approved", color: "var(--status-approved-fg)", bg: "var(--status-approved-bg)" },
                ].map((s) => (
                  <div key={s.label} style={{ background: s.bg, borderRadius: "var(--radius)", padding: "8px 10px", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 600, color: s.color, lineHeight: 1, marginBottom: 4 }}>{s.val}</div>
                    <div style={{ fontSize: 10.5, color: s.color, opacity: 0.8 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {progressBar(p)}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--fg-tertiary)" }}>
                <span>{p.totalActions} actions</span>
                <span>·</span>
                <span>{p.approvedCount} approved</span>
              </div>
            </Link>
          ))}
        </div>

        {/* Needs attention */}
        {sentBack.length > 0 && (
          <>
            <SectionHeader title="Needs attention" />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 32 }}>
              {sentBack.map((d) => (
                <Link key={d.deliverableId} href={`/projects`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#FFFCF7", border: "1px solid #E8D0A8", borderRadius: "var(--radius)", fontSize: 12.5, textDecoration: "none", color: "inherit" }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: "var(--status-returned-fg)", flexShrink: 0, width: 36 }}>{d.actionNumber}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--fg)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.actionTitle}</div>
                    <div style={{ fontSize: 11.5, color: "var(--fg-tertiary)", marginTop: 2 }}>Returned · deliverable ({d.letter.toLowerCase()})</div>
                  </div>
                  <Chip label="Returned" variant="returned" />
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Aside */}
      <div style={{ width: 280, flexShrink: 0, padding: "24px 20px", background: "var(--bg)", position: "sticky", top: 48 }}>
        <SectionHeader title="Recent activity" />
        <EmptyFeed />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage(): Promise<JSX.Element> {
  const ctx = await getContext();
  if (!ctx) redirect("/login");

  const projectStats = await getProjectsWithStats(ctx.workspaceId, ctx.workspaceType);

  if (ctx.workspaceType === "consultant") {
    const submitted = await getSubmittedDeliverables(ctx.workspaceId);
    return <ConsultantDashboard ctx={ctx} projectStats={projectStats} submitted={submitted} />;
  }

  if (ctx.workspaceType === "bank") {
    return <BankDashboard ctx={ctx} projectStats={projectStats} />;
  }

  // loanee
  const sentBack = await getSentBackDeliverables(ctx.workspaceId);
  return <LoaneeDashboard ctx={ctx} projectStats={projectStats} sentBack={sentBack} />;
}

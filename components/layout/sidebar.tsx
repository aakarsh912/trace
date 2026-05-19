import { SidebarNav } from "./sidebar-nav";
import { SidebarPersona } from "./sidebar-persona";
import type { WorkspaceOption } from "@/lib/auth/active-workspace";

type SidebarProps = {
  userName: string;
  workspaces: WorkspaceOption[];
  activeWorkspaceId: string;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const WORKSPACE_ACCENT: Record<string, string> = {
  bank: "#2B3F6A",
  consultant: "#3F3F3F",
  loanee: "#1E4B3B",
};

export function Sidebar({
  userName,
  workspaces,
  activeWorkspaceId,
}: SidebarProps): JSX.Element {
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0]!;
  const avatarBg = WORKSPACE_ACCENT[active.type] ?? "#3F3F3F";

  return (
    <aside
      style={{
        background: "var(--bg)",
        borderRight: "1px solid var(--border)",
        padding: "16px 12px 0 12px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        position: "sticky",
        top: 0,
        height: "100vh",
        width: 240,
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* Brand */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 8px 20px 8px",
          fontWeight: 600,
          fontSize: 15,
          letterSpacing: "-0.01em",
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            background: "var(--fg)",
            borderRadius: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 11,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          T
        </div>
        Trace
      </div>

      {/* Nav */}
      <SidebarNav />

      {/* Persona footer with workspace switcher + sign-out */}
      <SidebarPersona
        userName={userName}
        initials={getInitials(userName)}
        avatarBg={avatarBg}
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
      />
    </aside>
  );
}

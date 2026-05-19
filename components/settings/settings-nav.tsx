"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WorkspaceMemberRole } from "@/lib/db/schema";

type Props = { role: WorkspaceMemberRole };

export function SettingsNav({ role }: Props): JSX.Element {
  const pathname = usePathname();
  const isAdmin = role === "admin";

  return (
    <aside
      style={{
        borderRight: "1px solid var(--border)",
        padding: "24px 16px",
        background: "var(--bg)",
      }}
    >
      <div className="settings-nav-section" style={{ marginTop: 0 }}>Workspace</div>
      <NavLink href="/settings/general" label="General" active={pathname === "/settings/general"} />
      {isAdmin && (
        <NavLink href="/settings/members" label="Members" active={pathname === "/settings/members"} />
      )}
      {!isAdmin && (
        <NavLink href="/settings/members" label="Members" active={pathname === "/settings/members"} />
      )}
    </aside>
  );
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }): JSX.Element {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "7px 10px",
        fontSize: 13,
        color: active ? "var(--fg)" : "var(--fg-secondary)",
        fontWeight: active ? 500 : 400,
        textDecoration: "none",
        borderRadius: 6,
        marginBottom: 1,
        background: active ? "var(--bg-subtle)" : "transparent",
      }}
      className={active ? "" : "settings-nav-link-hover"}
    >
      {label}
    </Link>
  );
}

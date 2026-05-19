"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

type TopbarProps = {
  children?: React.ReactNode;
};

type Segment = { label: string; href?: string };

function getBreadcrumb(pathname: string): Segment[] {
  if (pathname === "/dashboard") return [{ label: "Dashboard" }];
  if (pathname === "/projects") return [{ label: "All Projects" }];
  if (pathname.startsWith("/projects/")) {
    const parts = pathname.split("/").filter(Boolean);
    const crumbs: Segment[] = [{ label: "All Projects", href: "/projects" }];
    if (parts.length >= 2) crumbs.push({ label: "Project" });
    if (parts.length >= 4 && parts[2] === "actions") crumbs.push({ label: "Action" });
    return crumbs;
  }
  if (pathname.startsWith("/settings")) {
    const sub = pathname.split("/")[2];
    const label = sub === "members" ? "Members" : "General";
    return [{ label: "Settings", href: "/settings/general" }, { label: label }];
  }
  return [{ label: "Dashboard" }];
}

export function Topbar({ children }: TopbarProps): JSX.Element {
  const pathname = usePathname();
  const crumbs = getBreadcrumb(pathname);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 24px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-surface)",
        position: "sticky",
        top: 0,
        zIndex: 10,
        height: 48,
        flexShrink: 0,
      }}
    >
      {/* Breadcrumb */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 13,
          color: "var(--fg-tertiary)",
        }}
      >
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1;
          return (
            <span
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {i > 0 && (
                <span style={{ color: "var(--fg-disabled)", fontSize: 11 }}>
                  /
                </span>
              )}
              {isLast ? (
                <span style={{ color: "var(--fg)", fontWeight: 500 }}>
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href ?? "#"}
                  style={{
                    color: "var(--fg-tertiary)",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) =>
                    ((e.target as HTMLElement).style.color = "var(--fg)")
                  }
                  onMouseLeave={(e) =>
                    ((e.target as HTMLElement).style.color = "var(--fg-tertiary)")
                  }
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          );
        })}
      </div>

      {/* Right-side action slot */}
      {children && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {children}
        </div>
      )}
    </div>
  );
}

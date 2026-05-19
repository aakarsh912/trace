"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="2" y="2" width="5" height="5" rx="1" />
        <rect x="9" y="2" width="5" height="5" rx="1" />
        <rect x="2" y="9" width="5" height="5" rx="1" />
        <rect x="9" y="9" width="5" height="5" rx="1" />
      </svg>
    ),
  },
  {
    href: "/projects",
    label: "All Projects",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M2 4a1 1 0 0 1 1-1h3l2 2h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4z" />
      </svg>
    ),
  },
  {
    href: "/settings/general",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="8" cy="8" r="2" />
        <path d="M8 1v2M8 13v2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M1 8h2M13 8h2M3.5 12.5l1.5-1.5M11 5l1.5-1.5" />
      </svg>
    ),
  },
];

type SidebarNavProps = {
  className?: string;
};

export function SidebarNav({ className }: SidebarNavProps): JSX.Element {
  const pathname = usePathname();

  return (
    <div className={className}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: "var(--fg-tertiary)",
          padding: "14px 8px 6px 8px",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        Workspace
      </div>

      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/dashboard"
            ? pathname === "/dashboard"
            : item.href === "/settings/general"
            ? pathname.startsWith("/settings")
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              fontSize: 13,
              color: isActive ? "var(--fg)" : "var(--fg-secondary)",
              borderRadius: "var(--radius)",
              textDecoration: "none",
              fontWeight: isActive ? 500 : 400,
              background: isActive ? "var(--bg-surface)" : "transparent",
              boxShadow: isActive ? "0 0 0 1px var(--border)" : "none",
              transition: "background 80ms ease",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-hover)";
                (e.currentTarget as HTMLElement).style.color = "var(--fg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "var(--fg-secondary)";
              }
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                color: isActive ? "var(--fg)" : "var(--fg-tertiary)",
                flexShrink: 0,
                display: "flex",
              }}
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}

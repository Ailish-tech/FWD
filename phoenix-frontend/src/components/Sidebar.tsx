"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

const icons = {
  grid: <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
    </>
  ),
};

function Icon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

export function Sidebar() {
  const { user } = useAuth();
  const pathname = usePathname() ?? "";
  const match = pathname.match(/^\/workspaces\/([^/]+)/);
  const wsId = match?.[1];
  if (!user) return null;

  const item = (href: string, label: string, active: boolean, icon: keyof typeof icons) => (
    <Link href={href} className={active ? "side-link active" : "side-link"}>
      <Icon name={icon} />
      {label}
    </Link>
  );

  return (
    <aside className="sidebar">
      <p className="side-title">Navigate</p>
      {item("/workspaces", "All workspaces", pathname === "/workspaces", "grid")}
      {wsId && (
        <>
          <p className="side-title">This workspace</p>
          {item(`/workspaces/${wsId}`, "Projects & credits", pathname === `/workspaces/${wsId}`, "folder")}
          {item(`/workspaces/${wsId}/members`, "Team", pathname.endsWith("/members"), "users")}
        </>
      )}
      <p className="side-hint muted">
        Need help? Click <strong>ⓘ Info</strong> at the top for a quick guide.
      </p>
    </aside>
  );
}

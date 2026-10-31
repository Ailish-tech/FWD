"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { InfoButton } from "./InfoButton";

export function NavBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  return (
    <header className="nav">
      <Link href="/workspaces" className="brand">
        Phoenix
      </Link>
      <div className="nav-right">
        <InfoButton />
      {user && (
        <>
          <span className="muted">{user.email}</span>
          <button
            className="secondary"
            onClick={() => {
              logout();
              router.replace("/login");
            }}
          >
            Log out
          </button>
        </>
      )}
      </div>
    </header>
  );
}

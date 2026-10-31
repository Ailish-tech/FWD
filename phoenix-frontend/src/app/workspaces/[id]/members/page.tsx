"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, describeError } from "@/lib/api";
import type { Member, Role, Workspace } from "@/lib/types";

function Members({ id }: { id: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ws, ms] = await Promise.all([
        api<Workspace>(`/api/workspaces/${id}`),
        api<Member[]>(`/api/workspaces/${id}/members`),
      ]);
      setWorkspace(ws);
      setMembers(ms);
    } catch (err) {
      setError(describeError(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/api/workspaces/${id}/members`, { method: "POST", body: { email, role } });
      setEmail("");
      await load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  if (!workspace) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  return (
    <>
      <p>
        <Link href={`/workspaces/${id}`}>← {workspace.name}</Link>
      </p>
      <h1>Members</h1>
      <p className="hint">
        To add a teammate, type the email of someone who already has a Phoenix account (e.g.{" "}
        <code>bob@phoenix.dev</code>) and choose a role.
      </p>
      {error && <p className="error">{error}</p>}
      <ul className="list">
        {members.map((m) => (
          <li key={m.user_id}>
            {m.full_name} <span className="muted small">{m.email}</span>
            <span className="badge">{m.role}</span>
          </li>
        ))}
      </ul>
      {(workspace.role === "owner" || workspace.role === "admin") && (
        <form onSubmit={add} className="row">
          <input
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
          />
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
          <button>Add member</button>
        </form>
      )}
    </>
  );
}

export default function MembersPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <Members key={id} id={id} />
    </RequireAuth>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, describeError } from "@/lib/api";
import type { Workspace } from "@/lib/types";

function WorkspaceList() {
  const [workspaces, setWorkspaces] = useState<Workspace[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  async function load() {
    try {
      setWorkspaces(await api<Workspace[]>("/api/workspaces", { cache: true }));
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      await api("/api/workspaces", { method: "POST", body: { name } });
      setName("");
      await load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  return (
    <>
      <h1>Your workspaces</h1>
      <p className="muted">A workspace is a team space. Open one to see its projects, credits and members.</p>
      {error && <p className="error">{error}</p>}
      {workspaces === null && !error && <p className="muted">Loading…</p>}
      {workspaces?.length === 0 && <p className="muted">You are not in any workspace yet.</p>}
      <ul className="list">
        {workspaces?.map((w) => (
          <li key={w.id}>
            <Link href={`/workspaces/${w.id}`}>{w.name}</Link>
            <span className="badge">{w.role}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={create} className="row">
        <input
          placeholder="New workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button>Create</button>
      </form>
    </>
  );
}

export default function WorkspacesPage() {
  return (
    <RequireAuth>
      <WorkspaceList />
    </RequireAuth>
  );
}

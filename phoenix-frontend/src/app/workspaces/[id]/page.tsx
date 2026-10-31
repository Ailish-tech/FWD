"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, describeError } from "@/lib/api";
import type { Project, Workspace } from "@/lib/types";

function TopUp({ id, onDone }: { id: string; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState("10");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/workspaces/${id}/credits/topup`, { method: "POST", body: { amount: Number(amount) } });
      await onDone();
      setMsg({ ok: true, text: `Added ${amount} credits.` });
    } catch (err) {
      setMsg({ ok: false, text: describeError(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel" id="credits">
      <h3>Top up credits</h3>
      <p className="muted small">Each new task costs 1 credit. Only the workspace owner can add credits (1–1000 at a time).</p>
      <form onSubmit={submit} className="row">
        <input
          type="number"
          min={1}
          max={1000}
          step={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Credits to add"
          required
        />
        <button disabled={busy}>{busy ? "Adding…" : "Add credits"}</button>
        {msg && <span className={msg.ok ? "ok" : "error"}>{msg.text}</span>}
      </form>
    </div>
  );
}

function WorkspaceDetail({ id }: { id: string }) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    try {
      const [ws, ps, credits] = await Promise.all([
        api<Workspace>(`/api/workspaces/${id}`),
        api<Project[]>(`/api/workspaces/${id}/projects`, { cache: true }),
        api<{ balance: number }>(`/api/workspaces/${id}/credits`),
      ]);
      setWorkspace(ws);
      setProjects(ps);
      setBalance(credits.balance);
      setError(null);
    } catch (err) {
      setError(describeError(err));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function createProject(e: FormEvent) {
    e.preventDefault();
    try {
      await api(`/api/workspaces/${id}/projects`, { method: "POST", body: { name } });
      setName("");
      await load();
    } catch (err) {
      setError(describeError(err));
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!workspace) return <p className="muted">Loading…</p>;

  return (
    <>
      <p>
        <Link href="/workspaces">← Workspaces</Link>
      </p>
      <h1>{workspace.name}</h1>
      <p>
        Credits: <strong data-testid="credits">{balance}</strong>{" "}
        <span className="badge">{workspace.role}</span>{" "}
        <Link href={`/workspaces/${id}/members`}>Manage members</Link>
      </p>
      {workspace.role === "owner" && <TopUp id={id} onDone={load} />}
      <h2>Projects</h2>
      <p className="muted small">Projects group your tasks. Open one to add and search tasks.</p>
      {projects.length === 0 && <p className="muted">No projects yet.</p>}
      <ul className="list">
        {projects.map((p) => (
          <li key={p.id}>
            <Link href={`/projects/${p.id}`}>{p.name}</Link>
            <span className="muted small">{p.description}</span>
          </li>
        ))}
      </ul>
      <form onSubmit={createProject} className="row">
        <input
          placeholder="New project name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <button>Add project</button>
      </form>
    </>
  );
}

export default function WorkspacePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <WorkspaceDetail id={id} />
    </RequireAuth>
  );
}

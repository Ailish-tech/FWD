"use client";

import { format } from "date-fns";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { api, describeError } from "@/lib/api";
import type { Project, Task, TaskPage, TaskStatus } from "@/lib/types";

const PAGE_SIZE = 10;

function formatDate(iso: string) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "dd MMM yyyy, HH:mm");
  } catch {
    return iso;
  }
}

function TaskBoard({ id }: { id: string }) {
  const [project, setProject] = useState<Project | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "">("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TaskPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeReqId = useRef(0);

  useEffect(() => {
    api<Project>(`/api/projects/${id}`).then(setProject).catch((err) => setError(describeError(err)));
  }, [id]);

  const fetchTasks = useCallback(
    async (q: string, p: number, s: TaskStatus | "") => {
      const reqId = ++activeReqId.current;
      const params = new URLSearchParams({ page: String(p), page_size: String(PAGE_SIZE) });
      if (q) params.set("q", q);
      if (s) params.set("status", s);
      try {
        const res = await api<TaskPage>(`/api/projects/${id}/tasks?${params}`);
        if (reqId === activeReqId.current) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (reqId === activeReqId.current) {
          setError(describeError(err));
          setData(null);
        }
      }
    },
    [id]
  );

  // debounce search & handle filter changes
  useEffect(() => {
    const t = setTimeout(() => fetchTasks(query, page, status), 300);
    return () => clearTimeout(t);
  }, [query, page, status, fetchTasks]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      {project && (
        <p>
          <Link href={`/workspaces/${project.workspace_id}`}>← Back to workspace</Link>
        </p>
      )}
      <h1>{project?.name ?? "Project"}</h1>
      <NewTaskForm projectId={id} onCreated={() => fetchTasks(query, page, status)} />
      <div className="row">
        <input
          placeholder="Search tasks…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          aria-label="Search tasks"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as TaskStatus | "");
            setPage(1);
          }}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          <option value="todo">To do</option>
          <option value="doing">Doing</option>
          <option value="done">Done</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {data === null && !error && <p className="muted">Loading…</p>}
      {data?.items.length === 0 && !error && <p className="muted">No tasks match.</p>}

      {data && data.items.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Title</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t: Task) => (
              <tr key={t.id}>
                <td className="small">{t.id.slice(-6)}</td>
                <td>{t.title}</td>
                <td>
                  <span className={`badge ${t.status}`}>{t.status}</span>
                </td>
                <td className="small">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="row pager">
        <button className="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
        <span>
          Page {page} of {totalPages} {data && <span className="muted">({data.total} tasks)</span>}
        </span>
        <button
          className="secondary"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </>
  );
}

function NewTaskForm({ projectId, onCreated }: { projectId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const idempotencyKey = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now());
      await api(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        body: { title },
        headers: { "Idempotency-Key": idempotencyKey },
      });
      setTitle("");
      onCreated();
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="row">
      <input
        placeholder="New task title (costs 1 credit)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button disabled={busy}>{busy ? "Creating…" : "Create task"}</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <TaskBoard id={id} />
    </RequireAuth>
  );
}

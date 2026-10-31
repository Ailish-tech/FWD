// The public JSON contract is snake_case with string ids.
import type { Types } from "mongoose";

type Id = Types.ObjectId;
const id = (v: Id | null | undefined) => (v ? String(v) : null);

export const userOut = (u: { _id: Id; email: string; fullName: string }) => ({
  id: String(u._id),
  email: u.email,
  full_name: u.fullName,
});

export const projectOut = (p: {
  _id: Id; workspace: Id; name: string; description?: string | null; createdAt?: Date | string | null;
}) => ({
  id: String(p._id),
  workspace_id: String((p.workspace as any)?._id ?? p.workspace),
  name: p.name,
  description: p.description ?? "",
  created_at: new Date(p.createdAt ?? Date.now()).toISOString(),
});

export const taskOut = (t: {
  _id: Id; project: Id; title: string; status: string; createdBy: Id; assignee?: Id | null; createdAt: Date | string;
}) => ({
  id: String(t._id),
  project_id: String((t.project as any)?._id ?? t.project),
  title: t.title,
  status: t.status,
  created_by_id: String((t.createdBy as any)?._id ?? t.createdBy),
  assignee_id: t.assignee ? String((t.assignee as any)?._id ?? t.assignee) : null,
  created_at: new Date(t.createdAt ?? Date.now()).toISOString(),
});

export type Role = "owner" | "admin" | "member";
export type TaskStatus = "todo" | "doing" | "done";

export interface User {
  id: string;
  email: string;
  full_name: string;
}

export interface TokenResponse {
  access_token: string;
  token?: string;
  token_type: string;
  user: User;
}

export interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  role: Role;
}

export interface Member {
  user_id: string;
  email: string;
  full_name: string;
  role: Role;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
  created_by_id: string;
  assignee_id: string | null;
  created_at: string;
}

export interface TaskPage {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
}

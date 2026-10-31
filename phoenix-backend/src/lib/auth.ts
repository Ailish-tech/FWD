import type { Types } from "mongoose";
import { Project, User, WorkspaceMember } from "../models";
import { asyncHandler, HttpError } from "./http";
import { decodeAccessToken } from "./security";

export type CurrentUser = { _id: Types.ObjectId; email: string; fullName: string };

export const requireUser = asyncHandler(async (req, res, next) => {
  const [scheme, token] = (req.headers.authorization ?? "").split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    throw new HttpError(401, "Not authenticated");
  }
  let userId: string;
  try {
    userId = decodeAccessToken(token);
  } catch {
    throw new HttpError(401, "Invalid or expired token");
  }
  const user = /^[a-f0-9]{24}$/i.test(userId) ? await User.findById(userId).lean() : null;
  if (!user) throw new HttpError(401, "User no longer exists");
  res.locals.user = user;
  next();
});

export function currentUser(locals: Record<string, unknown>): CurrentUser {
  return locals.user as CurrentUser;
}

export async function requireMember(workspaceId: Types.ObjectId, user: CurrentUser) {
  const member = await WorkspaceMember.findOne({ workspace: workspaceId, user: user._id }).lean();
  // 404 rather than 403 so we don't leak which workspace ids exist.
  if (!member) throw new HttpError(404, "Workspace not found");
  return member;
}

export async function requireAdmin(workspaceId: Types.ObjectId, user: CurrentUser) {
  const member = await requireMember(workspaceId, user);
  if (member.role !== "owner" && member.role !== "admin") {
    throw new HttpError(403, "Admin role required");
  }
  return member;
}

export async function getProjectForUser(projectId: Types.ObjectId, user: CurrentUser) {
  const project = await Project.findById(projectId).lean();
  if (!project) throw new HttpError(404, "Project not found");
  await requireMember(project.workspace, user);
  return project;
}

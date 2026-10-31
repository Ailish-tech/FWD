import mongoose, { Schema, model } from "mongoose";

export const ROLES = ["owner", "admin", "member"] as const;

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true },
    credits: { type: Number, default: 0 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
export const Workspace = model("Workspace", workspaceSchema);

const memberSchema = new Schema({
  workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ROLES, required: true, default: "member" },
});
memberSchema.index({ workspace: 1, user: 1 }, { unique: true });
export const WorkspaceMember = model("WorkspaceMember", memberSchema);

import mongoose, { Schema, model } from "mongoose";

export const TASK_STATUSES = ["todo", "doing", "done"] as const;

const taskSchema = new Schema({
  project: { type: Schema.Types.ObjectId, ref: "Project", required: true },
  title: { type: String, required: true, trim: true },
  status: { type: String, enum: TASK_STATUSES, required: true, default: "todo" },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, required: true, default: () => new Date() },
});
taskSchema.index({ project: 1, createdAt: -1, _id: -1 });
export const Task = model("Task", taskSchema);

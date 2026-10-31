import mongoose, { Schema, model } from "mongoose";

const projectSchema = new Schema(
  {
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
export const Project = model("Project", projectSchema);

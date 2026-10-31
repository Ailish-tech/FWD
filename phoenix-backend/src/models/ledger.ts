import mongoose, { Schema, model } from "mongoose";

/** Append-only credit history. */
const ledgerSchema = new Schema(
  {
    workspace: { type: Schema.Types.ObjectId, ref: "Workspace", required: true, index: true },
    delta: { type: Number, required: true },
    reason: { type: String, required: true },
    task: { type: Schema.Types.ObjectId, ref: "Task", default: null },
    idempotencyKey: { type: String, default: undefined },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
ledgerSchema.index(
  { workspace: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);
export const CreditLedger = model("CreditLedger", ledgerSchema);

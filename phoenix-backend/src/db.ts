import dns from "node:dns";
import mongoose from "mongoose";
import { CreditLedger, Project, Task, User, Workspace, WorkspaceMember } from "./models";

try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch {
  // ignore in environments that restrict DNS changes
}

mongoose.set("strictQuery", true);
mongoose.set("autoIndex", true);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ALL_MODELS: mongoose.Model<any>[] = [User, Workspace, WorkspaceMember, Project, Task, CreditLedger];

export async function connectDb(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri);
  await Promise.all(ALL_MODELS.map((m) => m.syncIndexes()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

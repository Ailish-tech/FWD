// Demo data.
//   npm run seed          -> creates the demo data if it isn't there yet (safe to re-run)
//   npm run seed:reset    -> wipes the Phoenix collections and seeds again
import { getSettings } from "../src/config";
import { ALL_MODELS, connectDb, disconnectDb } from "../src/db";
import { hashPassword } from "../src/lib/security";
import { CreditLedger, Project, Task, User, Workspace, WorkspaceMember } from "../src/models";

export const DEMO_PASSWORD = "phoenix123";

export async function seed({ reset = false } = {}) {
  if (reset) {
    for (const m of ALL_MODELS) await m.deleteMany({});
  } else if (await User.exists({ email: "alice@phoenix.dev" })) {
    console.log("seed: demo data already present, skipping (use --reset to recreate)");
    return;
  }

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const [alice, bob, carol] = await User.create([
    { email: "alice@phoenix.dev", fullName: "Alice Owner", passwordHash },
    { email: "bob@phoenix.dev", fullName: "Bob Member", passwordHash },
    { email: "carol@phoenix.dev", fullName: "Carol Outsider", passwordHash },
  ]);

  const acme = await Workspace.create({ name: "Acme Corp", owner: alice._id, credits: 3 });
  const globex = await Workspace.create({ name: "Globex Secret Lab", owner: carol._id, credits: 3 });
  await WorkspaceMember.create([
    { workspace: acme._id, user: alice._id, role: "owner" },
    { workspace: acme._id, user: bob._id, role: "member" },
    { workspace: globex._id, user: carol._id, role: "owner" },
  ]);
  await CreditLedger.create([
    { workspace: acme._id, delta: 3, reason: "welcome credits" },
    { workspace: globex._id, delta: 3, reason: "welcome credits" },
  ]);

  const [website, mobile] = await Project.create([
    { workspace: acme._id, name: "Website Revamp", description: "New marketing site and dashboard" },
    { workspace: acme._id, name: "Mobile App", description: "iOS + Android" },
  ]);
  const secret = await Project.create({
    workspace: globex._id, name: "Project Nightingale", description: "Confidential - Globex only",
  });

  const batchTs = new Date("2026-05-01T23:30:00Z");
  const statuses = ["todo", "doing", "done"];
  await Task.insertMany(
    Array.from({ length: 25 }, (_, k) => ({
      project: website._id,
      title: `Website task ${String(k + 1).padStart(2, "0")}`,
      status: statuses[(k + 1) % 3],
      createdBy: alice._id,
      assignee: (k + 1) % 2 ? bob._id : null,
      createdAt: batchTs,
    }))
  );
  await Task.insertMany(
    Array.from({ length: 5 }, (_, k) => ({
      project: mobile._id,
      title: `Mobile task ${k + 1}`,
      status: "todo",
      createdBy: bob._id,
      createdAt: new Date(batchTs.getTime() + (k + 1) * 60_000),
    }))
  );
  await Task.create({ project: secret._id, title: "Launch codes", status: "todo", createdBy: carol._id });

  console.log(`seed: demo data created. Logins (password ${DEMO_PASSWORD}):`);
  console.log("  alice@phoenix.dev  - owner of Acme Corp (3 credits)");
  console.log("  bob@phoenix.dev    - member of Acme Corp");
  console.log("  carol@phoenix.dev  - owner of Globex Secret Lab, NOT in Acme");
}

async function main() {
  await connectDb(getSettings().MONGO_URL);
  await seed({ reset: process.argv.includes("--reset") });
  await disconnectDb();
}

main()
  .then(() => {
    console.log("seed: done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

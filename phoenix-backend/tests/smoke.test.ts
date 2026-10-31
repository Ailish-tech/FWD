import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

let app: import("express").Express;
beforeAll(async () => {
  app = (await import("../src/app")).createApp();
});

async function login(email = "alice@phoenix.dev") {
  const r = await request(app).post("/api/auth/login").send({ email, password: "phoenix123" });
  expect(r.status).toBe(200);
  return { Authorization: `Bearer ${r.body.access_token}` };
}

describe("smoke", () => {
  it("health reports the database is reachable", async () => {
    const r = await request(app).get("/api/health");
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "ok", db: "ok" });
  });

  it("login returns an access token", async () => {
    const r = await request(app)
      .post("/api/auth/login")
      .send({ email: "alice@phoenix.dev", password: "phoenix123" });
    expect(r.status).toBe(200);
    expect(r.body.token_type).toBe("bearer");
    expect(r.body.user.email).toBe("alice@phoenix.dev");
  });

  it("lists workspaces", async () => {
    const r = await request(app).get("/api/workspaces").set(await login());
    expect(r.status).toBe(200);
    expect(r.body.map((w: { name: string }) => w.name)).toEqual(["Acme Corp"]);
  });

  it("lists the first page of tasks", async () => {
    const h = await login();
    const ws = (await request(app).get("/api/workspaces").set(h)).body[0];
    const projects = (await request(app).get(`/api/workspaces/${ws.id}/projects`).set(h)).body;
    const website = projects.find((p: { name: string }) => p.name === "Website Revamp");
    const r = await request(app).get(`/api/projects/${website.id}/tasks?page=1&page_size=10`).set(h);
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(25);
    expect(r.body.items).toHaveLength(10);
  });

  it("creating a task spends a credit", async () => {
    const h = await login();
    const ws = (await request(app).get("/api/workspaces").set(h)).body[0];
    const before = (await request(app).get(`/api/workspaces/${ws.id}/credits`).set(h)).body.balance;
    const project = (await request(app).get(`/api/workspaces/${ws.id}/projects`).set(h)).body[0];
    const r = await request(app).post(`/api/projects/${project.id}/tasks`).set(h).send({ title: "Smoke task" });
    expect(r.status).toBe(201);
    const after = (await request(app).get(`/api/workspaces/${ws.id}/credits`).set(h)).body.balance;
    expect(after).toBe(before - 1);
  });
});

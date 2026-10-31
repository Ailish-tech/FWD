# Routing Analysis & Proposed Solutions — Project Phoenix

This document provides a thorough audit of the routing and request pipeline disturbances identified across **phoenix-backend** and **phoenix-frontend**, along with recommended best-practice solutions for each issue.

---

## 1. Phoenix Backend (`phoenix-backend/`)

### Issue 1.1: Express Middleware Order Inversion (`express.json()`)
* **Location:** [`src/app.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/src/app.ts#L17-L27)
* **Symptom:** Every POST or PUT request (such as `/api/auth/register`, `/api/auth/login`, `/api/workspaces`, `/api/projects`, `/api/projects/:id/tasks`) fails schema validation with `body is required` or receives `req.body === undefined`.
* **Root Cause:** `app.use(express.json({ limit: "100kb" }))` was mounted **after** all routers (`healthRouter`, `authRouter`, `workspacesRouter`, `projectsRouter`, `tasksRouter`). In Express, middleware executes sequentially in the order registered; routes were processing requests before the JSON body parser could execute.
* **Best Solution:** Move `app.use(express.json({ limit: "100kb" }))` immediately after CORS configuration, before mounting any routers.
  ```typescript
  // src/app.ts
  export function createApp() {
    const settings = getSettings();
    const app = express();
    app.disable("x-powered-by");
    app.set("trust proxy", 1);

    app.use(cors({ origin: settings.corsOriginList, credentials: true }));
    app.use(express.json({ limit: "100kb" })); // Parse incoming JSON before routes

    app.use(healthRouter);
    app.use(authRouter);
    app.use(workspacesRouter);
    app.use(projectsRouter);
    app.use(tasksRouter);

    app.use(notFound);
    app.use(errorHandler);
    return app;
  }
  ```

---

### Issue 1.2: Express 5 vs Express 4 Wildcard Path Conflict
* **Location:** [`package.json`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/package.json#L23) & [`src/app.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/src/app.ts#L26)
* **Symptom:** Wildcard catch-all (`app.all("*", notFound)`) can fail or throw path parsing exceptions with newer `path-to-regexp` engines, and package versions mismatch the project specification.
* **Root Cause:** `package.json` installs `"express": "5.3.0"`, but the README specifies **Express 4** and `@types/express` is `4.17.25`. Express 5 altered path matching syntax (e.g. unescaped wildcard `*` behavior).
* **Best Solution:**
  1. Pin Express to `^4.21.2` in `package.json` to match the project specification and types.
  2. Implement the catch-all either as `app.use(notFound)` or maintain clean Express 4 middleware routing.

---

### Issue 1.3: Vercel Serverless Routing Target Mismatch & Local Listen
* **Location:** [`vercel.json`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/vercel.json#L3) & [`api/index.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/api/index.ts#L6-L10)
* **Symptom:** Deployments to Vercel return `404 Not Found` for all routes or hang/timeout on execution.
* **Root Cause:**
  1. `vercel.json` rewrites all traffic `/(.*)` to `/api/server`, but the actual serverless handler file is `api/index.ts`.
  2. `api/index.ts` calls `app.listen(getSettings().PORT)` inside a serverless invocation, which is invalid in lambda execution environments and blocks execution.
  3. `connectDb()` is called without caching the active connection or awaiting connection readiness across invocations.
* **Best Solution:**
  1. Update `vercel.json` to rewrite to `/api/index`:
     ```json
     {
       "$schema": "https://openapi.vercel.sh/vercel.json",
       "rewrites": [{ "source": "/(.*)", "destination": "/api/index" }]
     }
     ```
  2. In `api/index.ts`, ensure DB connection reuse and delegate to Express without `app.listen()`:
     ```typescript
     // api/index.ts
     import type { Request, Response } from "express";
     import { createApp } from "../src/app";
     import { getSettings } from "../src/config";
     import { connectDb } from "../src/db";

     const app = createApp();
     let isConnected = false;

     export default async function handler(req: Request, res: Response) {
       if (!isConnected) {
         await connectDb(getSettings().MONGO_URL);
         isConnected = true;
       }
       return app(req, res);
     }
     ```

---

### Issue 1.4: Health Check False Positive
* **Location:** [`src/routes/health.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/src/routes/health.ts#L6-L8)
* **Symptom:** `GET /api/health` returns `{"status":"ok","db":"ok"}` even when MongoDB is disconnected or down.
* **Root Cause:** The handler returns a static JSON literal without inspecting `mongoose.connection.readyState`.
* **Best Solution:** Check Mongoose's connection state and return an accurate status code (503 if disconnected):
  ```typescript
  import { Router } from "express";
  import mongoose from "mongoose";
  import { getSettings } from "../config";

  export const healthRouter = Router();

  healthRouter.get("/api/health", (_req, res) => {
    const isDbConnected = mongoose.connection.readyState === 1;
    const statusCode = isDbConnected ? 200 : 503;
    res.status(statusCode).json({
      status: isDbConnected ? "ok" : "degraded",
      version: getSettings().APP_VERSION,
      db: isDbConnected ? "ok" : "down",
    });
  });
  ```

---

### Issue 1.5: Idempotency Key Header Format Discrepancy
* **Location:** [`src/routes/tasks.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/src/routes/tasks.ts#L43)
* **Symptom:** Idempotency checks are bypassed when standard HTTP clients send `Idempotency-Key` or `idempotency-key`.
* **Root Cause:** The code reads `req.headers["idempotency_key"]` (with underscore).
* **Best Solution:** Support both standard hyphenated and underscore header names:
  ```typescript
  const rawKey = req.headers["idempotency-key"] ?? req.headers["idempotency_key"];
  const key = typeof rawKey === "string" ? rawKey : null;
  ```

---

### Issue 1.6: CORS Origins Environment String Parsing
* **Location:** [`src/config.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-backend/src/config.ts#L28)
* **Symptom:** Backend crashes on startup with `SyntaxError: Unexpected token 'h', "http://loca"... is not valid JSON` when `CORS_ORIGINS="http://localhost:3000"`.
* **Root Cause:** `JSON.parse(parsed.data.CORS_ORIGINS)` assumes a JSON string array rather than accommodating plain URLs or comma-separated origins.
* **Best Solution:** Safely parse JSON array or split comma-separated strings:
  ```typescript
  let corsOriginList: string[];
  try {
    const parsedJson = JSON.parse(parsed.data.CORS_ORIGINS);
    corsOriginList = Array.isArray(parsedJson) ? parsedJson : [String(parsedJson)];
  } catch {
    corsOriginList = parsed.data.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  }
  ```

---

## 2. Phoenix Frontend (`phoenix-frontend/`)

### Issue 2.1: Incompatible `useRouter` Hook (App Router vs Pages Router)
* **Location:** [`src/app/login/page.tsx`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-frontend/src/app/login/page.tsx#L3)
* **Symptom:** Clicking "Sign in" crashes the client with:
  ```
  Error: NextRouter was not mounted. https://nextjs.org/docs/messages/next-router-not-mounted
  ```
* **Root Cause:** In Next.js 14 App Router (`src/app/`), `useRouter` must be imported from `next/navigation`, not `next/router`.
* **Best Solution:** Update the import statement:
  ```typescript
  // src/app/login/page.tsx
  import { useRouter } from "next/navigation";
  ```

---

### Issue 2.2: Backend URL Configuration Key Mismatch
* **Location:** [`src/lib/api.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-frontend/src/lib/api.ts#L3)
* **Symptom:** All API calls route to `http://localhost:8000` regardless of what is configured in `.env.local` or Vercel environment variables.
* **Root Cause:** The documentation and `.env.example` instruct setting `NEXT_PUBLIC_API_URL`, but `api.ts` checks `process.env.NEXT_PUBLIC_BACKEND_URL`.
* **Best Solution:** Support `NEXT_PUBLIC_API_URL` with fallback to `NEXT_PUBLIC_BACKEND_URL`:
  ```typescript
  const API_URL =
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_BACKEND_URL ||
    "http://localhost:8000";
  ```

---

### Issue 2.3: Top-Level `localStorage` SSR Crash & Token Storage Divergence
* **Location:** [`src/lib/api.ts`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-frontend/src/lib/api.ts#L8-L23) & [`src/lib/auth.tsx`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-frontend/src/lib/auth.tsx#L43)
* **Symptom:**
  1. Next.js production build (`next build`) or server-side renders crash with `ReferenceError: localStorage is not defined`.
  2. Users get logged out immediately or redirected back to `/login` because `Authorization: Bearer <token>` is omitted from subsequent requests.
* **Root Cause:**
  1. `let token = localStorage.getItem(TOKEN_KEY)` runs during module evaluation on the Node.js server.
  2. Read key is `"phoenix.token"`, but `setToken()` writes to `"phoenix_token"`.
  3. `setToken()` never updates the in-memory `token` variable in `api.ts`.
  4. In `auth.tsx`, the code calls `setToken(res.token)`, but the backend JSON contract returns `access_token`.
* **Best Solution:**
  1. Consolidate token management in `src/lib/api.ts`:
     ```typescript
     export const TOKEN_KEY = "phoenix.token";

     let memoryToken: string | null = null;

     export function getToken(): string | null {
       if (memoryToken) return memoryToken;
       if (typeof window !== "undefined") {
         memoryToken = window.localStorage.getItem(TOKEN_KEY);
       }
       return memoryToken;
     }

     export function setToken(value: string | null) {
       memoryToken = value;
       if (typeof window !== "undefined") {
         if (value) window.localStorage.setItem(TOKEN_KEY, value);
         else window.localStorage.removeItem(TOKEN_KEY);
       }
     }
     ```
  2. In `src/lib/auth.tsx` & `src/lib/types.ts`, map `access_token` correctly:
     ```typescript
     // types.ts
     export interface TokenResponse {
       access_token: string;
       token_type: string;
       user: User;
     }

     // auth.tsx
     const res = await api<TokenResponse>("/api/auth/login", {
       method: "POST",
       body: { email, password },
     });
     setToken(res.access_token);
     setUser(res.user);
     ```

---

### Issue 2.4: Incompatible `date-fns` Subpath Import on Task Board Route
* **Location:** [`src/app/projects/[id]/page.tsx`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-frontend/src/app/projects/[id]/page.tsx#L3)
* **Symptom:** Compilation error: `Module not found: Can't resolve 'date-fns/format'`.
* **Root Cause:** `date-fns` version 3 removed deep subpath imports.
* **Best Solution:** Use named import from root package:
  ```typescript
  import { format } from "date-fns";
  ```

---

### Issue 2.5: Nonexistent Build Command in Frontend `vercel.json`
* **Location:** [`vercel.json`](file:///c:/Users/Ailish/OneDrive/Desktop/FWD/phoenix-frontend/vercel.json#L5)
* **Symptom:** Vercel frontend deployment fails during build step: `npm ERR! Missing script: "export"`.
* **Root Cause:** `vercel.json` specifies `"buildCommand": "npm run export"`, but Next.js 14 uses `next build` (`npm run build`).
* **Best Solution:** Fix or omit `buildCommand`:
  ```json
  {
    "$schema": "https://openapi.vercel.sh/vercel.json",
    "framework": "nextjs",
    "buildCommand": "npm run build"
  }
  ```

---

## 3. Summary of Resolution Strategy

| Component | Target File | Core Change |
|---|---|---|
| **Backend** | `src/app.ts` | Move `express.json()` before routers; fix wildcard routing. |
| **Backend** | `package.json` | Realign Express to `^4.21.2` matching `@types/express`. |
| **Backend** | `vercel.json` & `api/index.ts` | Rewrite to `/api/index`; remove `app.listen()` from serverless handler. |
| **Backend** | `src/routes/health.ts` | Validate `mongoose.connection.readyState === 1`. |
| **Backend** | `src/routes/tasks.ts` | Accept both `idempotency-key` and `idempotency_key`. |
| **Backend** | `src/config.ts` | Safe fallback parsing for `CORS_ORIGINS`. |
| **Frontend** | `src/app/login/page.tsx` | Change import to `next/navigation`. |
| **Frontend** | `src/lib/api.ts` | Use `NEXT_PUBLIC_API_URL`, unify token storage key, make SSR safe. |
| **Frontend** | `src/lib/auth.tsx` & `types.ts` | Map backend's `access_token` to frontend state. |
| **Frontend** | `src/app/projects/[id]/page.tsx` | Use `import { format } from "date-fns"`. |
| **Frontend** | `vercel.json` | Set `buildCommand: "npm run build"`. |


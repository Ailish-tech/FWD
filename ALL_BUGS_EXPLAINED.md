# Project Phoenix — Complete Bug Chronicle & Solutions Guide

This document presents a comprehensive, start-to-finish breakdown of every bug present in the inherited codebase, how and why each bug occurred, how it was solved, and how each resolution was verified.

---

## Table of Contents
1. [Arrival & Environment Setup](#1-arrival--environment-setup)
2. [Database & Mongoose Models](#2-database--mongoose-models)
3. [Server Middleware & HTTP Pipeline](#3-server-middleware--http-pipeline)
4. [Money, Data Integrity & Concurrency](#4-money-data-integrity--concurrency)
5. [Frontend & Browser Client](#5-frontend--browser-client)
6. [Cloud Launch & Serverless Deployment](#6-cloud-launch--serverless-deployment)
7. [CI/CD Pipeline & GitHub Automation](#7-cicd-pipeline--github-automation)

---

## 1. Arrival & Environment Setup

### 1.1 Package.json vs. Lockfile Dependency Conflicts
* **The Bug:** Running `npm ci` failed immediately in both `phoenix-backend` and `phoenix-frontend`.
* **How It Happened:**
  * In `phoenix-backend`: `package.json` declared `"express": "5.3.0"` and `"@vitest/coverage-v8": "1.6.1"`, but `package-lock.json` contained `"express": "4.22.3"` and `"@vitest/coverage-v8": "2.1.9"`. Additionally, `@types/express` was `4.17.25` and the project README explicitly required Express 4.
  * In `phoenix-frontend`: `package.json` specified `"react-dom": "17.0.2"` with `"react": "18.3.1"` (an incompatible peer dependency that npm rejects), and `date-fns: 3.6.0` was declared in `package.json` but completely missing from the lockfile.
* **How It Was Solved:**
  * Realigned `phoenix-backend/package.json` to `"express": "4.22.3"` and `"@vitest/coverage-v8": "2.1.9"`.
  * Upgraded `phoenix-frontend/package.json` to `"react-dom": "18.3.1"` and synchronized `date-fns: 3.6.0` in `package-lock.json`.
* **Verification:** `npm ci` completed cleanly with exit code 0 across both applications.

---

### 1.2 "A program that cannot find its own front door" — Build Output Directory Mismatch
* **The Bug:** Running `npm run build && npm start` in `phoenix-backend` crashed with:
  ```
  Error: Cannot find module 'dist/src/server.js'
  ```
* **How It Happened:** In `phoenix-backend/tsconfig.json`, `compilerOptions.outDir` was configured to `"build"`, whereas `package.json` specified `"main": "dist/src/server.js"` and `"start": "node dist/src/server.js"`. The TypeScript compiler deposited JavaScript files into `build/` while Node searched for them in `dist/`.
* **How It Was Solved:** Updated `phoenix-backend/tsconfig.json` to `"outDir": "dist"`.
* **Verification:** Built backend with `npm run build` and confirmed `dist/src/server.js` was created and executed by `npm start`.

---

### 1.3 "A program that wakes up speaking the wrong language" — CommonJS vs. ESM Conflict
* **The Bug:** Running the compiled backend crashed with:
  ```
  ReferenceError: exports is not defined in ES module scope
  ```
* **How It Happened:** `package.json` declared `"type": "module"`, instructing Node to treat all `.js` files as ES Modules. However, `tsconfig.json` had `"module": "CommonJS"`, emitting CommonJS output (`exports`, `require`). When Node attempted to execute CommonJS code in an ESM context, it threw a fatal reference error.
* **How It Was Solved:** Removed `"type": "module"` from `phoenix-backend/package.json`.
* **Verification:** Confirmed Node executes compiled `.js` files natively without module syntax errors.

---

### 1.4 Next.js Config Module Format Syntax Error
* **The Bug:** Running `npm run build` in `phoenix-frontend` crashed with:
  ```
  ReferenceError: module is not defined in ES module scope
  ```
* **How It Happened:** `next.config.mjs` is an ES module file (by virtue of the `.mjs` extension), but used CommonJS syntax `module.exports = nextConfig;`. Furthermore, it included deprecated `experimental.appDir: true` from older Next.js 13 builds.
* **How It Was Solved:** Changed `module.exports = nextConfig` to `export default nextConfig;` and removed `experimental.appDir`.
* **Verification:** Verified `next build` loads the configuration cleanly.

---

### 1.5 Deprecated TypeScript Compiler Flag
* **The Bug:** `npm run typecheck` in `phoenix-frontend` failed with:
  ```
  error TS5102: Option 'preserveValueImports' has been removed
  ```
* **How It Happened:** `phoenix-frontend/tsconfig.json` had `"preserveValueImports": true`. TypeScript 5.6 completely removed this deprecated option.
* **How It Was Solved:** Removed `"preserveValueImports": true` from `phoenix-frontend/tsconfig.json`.
* **Verification:** `npm run typecheck` passed with 0 errors.

---

### 1.6 Environment Variable Divergence & Strict Parsing Crashes
* **The Bug:**
  1. Backend crashed on startup with `SyntaxError: Unexpected token 'h', "http://loca"... is not valid JSON` when `CORS_ORIGINS="http://localhost:3000"`.
  2. Frontend ignored configured backend URLs and always fell back to `http://localhost:8000`.
* **How It Happened:**
  1. In `phoenix-backend/src/config.ts`, `JSON.parse(parsed.data.CORS_ORIGINS)` assumed a JSON array string `["http://..."]`, throwing a syntax error on simple comma-separated or singular URLs.
  2. `phoenix-frontend/src/lib/api.ts` checked `process.env.NEXT_PUBLIC_BACKEND_URL`, while documentation and `.env.example` mandated `NEXT_PUBLIC_API_URL`.
* **How It Was Solved:**
  1. Added safe fallback parsing in `src/config.ts`: attempts `JSON.parse()`, and falls back to comma-separated splitting.
  2. Updated `api.ts` to check `process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"`.
* **Verification:** Tested backend startup with singular URL, comma-separated URLs, and JSON array strings.

---

## 2. Database & Mongoose Models

### 2.1 Isolated Mongoose Connection
* **The Bug:** Mongoose models could not read or write data to MongoDB; queries hung or failed.
* **How It Happened:** In `phoenix-backend/src/db.ts`, `connectDb()` called `const conn = mongoose.createConnection(uri)`. In Mongoose, `createConnection()` creates an isolated connection instance; it does NOT connect Mongoose's default global instance where models (`model("User", ...)`) are registered.
* **How It Was Solved:** Replaced `mongoose.createConnection()` with `await mongoose.connect(uri)`.
* **Verification:** Models executed operations successfully against the connected database.

---

### 2.2 Unenforced Unique Constraints ("A promise written down, but never enforced")
* **The Bug:** Duplicate emails could be registered, and duplicate members could be added to the same workspace.
* **How It Happened:** `phoenix-backend/src/db.ts` had `mongoose.set("autoIndex", false)`. This prevented Mongoose from issuing `createIndex` calls to MongoDB, leaving declared `{ unique: true }` constraints unenforced. Additionally, deprecated driver options (`useNewUrlParser`, `useUnifiedTopology`, `useCreateIndex`) were being passed.
* **How It Was Solved:** Enabled `mongoose.set("autoIndex", true)`, removed obsolete connection options, and added `await Promise.all(ALL_MODELS.map(m => m.syncIndexes()))` inside `connectDb()`.
* **Verification:** Attempting to register duplicate emails or duplicate workspace memberships cleanly triggers MongoDB duplicate key errors (`11000`).

---

### 2.3 Duplicate Model Compilation Error
* **The Bug:** Application crashed during startup with:
  ```
  OverwriteModelError: Cannot overwrite 'User' model once compiled
  ```
* **How It Happened:** `src/models/user.ts` compiled the model via `export const User = model("User", userSchema)`. Then `src/models/index.ts` imported `userSchema` and called `model("User", userSchema)` a second time.
* **How It Was Solved:** Consolidated model compilation in `src/models/user.ts` and cleanly re-exported `User` in `src/models/index.ts`.
* **Verification:** Verified server initializes without `OverwriteModelError`.

---

### 2.4 Schema & Type Discrepancies
* **The Bug:** Password hashes were dropped during user registration; credit arithmetic failed; task statuses were rejected.
* **How It Happened:**
  1. `userSchema` defined `password: String` instead of `passwordHash: String`. Registration and seed scripts passed `passwordHash`, which Mongoose silently stripped because it was not in the schema.
  2. `workspaceSchema` defined `credits: { type: String, default: "0" }`. Mathematical decrements (`credits - 1`) converted the field to numbers or failed schema validation.
  3. `memberSchema` defined `user: { ref: "user" }` (lowercase), breaking Mongoose `.populate("user")` calls.
  4. `TASK_STATUSES` in `models/task.ts` was `["todo", "in_progress", "done"]`, contradicting the frontend and seed script which used `["todo", "doing", "done"]`.
* **How It Was Solved:**
  1. Renamed field to `passwordHash` in `userSchema`.
  2. Changed `credits` to `{ type: Number, default: 0 }`.
  3. Changed `ref` to `"User"`.
  4. Updated `TASK_STATUSES` to `["todo", "doing", "done"]`.
* **Verification:** Verified registration stores hashes, credit balances increment/decrement numerically, and tasks save with `"doing"` status.

---

### 2.5 Silent Premature Exit in Seed Script ("A seed that tells you everything went fine")
* **The Bug:** Running `npm run seed` logged "seed: done", but the database remained completely empty.
* **How It Happened:** In `scripts/seed.ts`, `main()` was called asynchronously without `await`, followed immediately by synchronous `console.log("seed: done")` and `process.exit(0)`. Node terminated the process before the asynchronous database insertions could begin.
* **How It Was Solved:** Awaited `main()` using promise chaining:
  ```typescript
  main().then(() => { console.log("seed: done"); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); });
  ```
* **Verification:** Confirmed all demo users, workspaces, projects, and 30 demo tasks are inserted into MongoDB.

---

### 2.6 Windows MongoDB SRV DNS Lookup Failures
* **The Bug:** Backend crashed when connecting to MongoDB Atlas with `querySrv ECONNREFUSED _mongodb._tcp...`.
* **How It Happened:** Node.js uses the local OS resolver by default; on Windows machines, certain corporate or local DNS servers refuse SRV record queries for `mongodb+srv://`.
* **How It Was Solved:** Added fallback public DNS resolvers in `src/db.ts`:
  ```typescript
  try { dns.setServers(["8.8.8.8", "1.1.1.1"]); } catch {}
  ```
* **Verification:** Atlas SRV connection strings resolve and connect reliably.

---

## 3. Server Middleware & HTTP Pipeline

### 3.1 Inverted Express Middleware Pipeline
* **The Bug:** All POST and PUT requests (`/api/auth/register`, `/api/auth/login`, `/api/workspaces`, `/api/projects`, `/api/projects/:id/tasks`) failed schema validation with missing body errors.
* **How It Happened:** In `src/app.ts`, `app.use(express.json({ limit: "100kb" }))` was mounted **after** all routers (`authRouter`, `workspacesRouter`, etc.). In Express, middleware executes sequentially; the routes executed before the body parser could parse the incoming stream, resulting in `req.body === undefined`.
* **How It Was Solved:** Moved `app.use(express.json({ limit: "100kb" }))` immediately above all router mounts.
* **Verification:** Verified `req.body` is populated for all incoming POST/PUT requests.

---

### 3.2 Cryptographic Key Signing vs. Verification Asymmetry
* **The Bug:** Every authenticated request returned `401 Invalid or expired token`, even immediately after logging in.
* **How It Happened:** In `src/lib/security.ts`, `createAccessToken()` signed JWTs using `s.JWT_ALGORITHM` (`"HS256"`), but `decodeAccessToken()` verified tokens with hardcoded `{ algorithms: ["HS512"] }`.
* **How It Was Solved:** Updated `decodeAccessToken()` to verify with `{ algorithms: [s.JWT_ALGORITHM] }`.
* **Verification:** Verified login issues tokens that authenticate successfully against protected endpoints.

---

### 3.3 Deceptive Health Check ("A health check that is always healthy is a liar")
* **The Bug:** `GET /api/health` returned HTTP 200 with `{ status: "ok", db: "ok" }` even when MongoDB was down or disconnected.
* **How It Happened:** `src/routes/health.ts` returned a static JSON literal without checking `mongoose.connection.readyState`.
* **How It Was Solved:** Updated the handler to check `mongoose.connection.readyState === 1`. Returns `200 {"status":"ok","db":"ok"}` when connected, and `503 {"status":"degraded","db":"down"}` when disconnected. Handled both `/api/health` and `/health`.
* **Verification:** Validated 200 when connected, and 503 when disconnected.

---

### 3.4 Unhandled Validation & Oversized Payload Errors
* **The Bug:** Invalid task payloads or oversized bodies (>100kb) crashed the backend with unhandled `500 Internal Server Error`.
* **How It Happened:** In `src/lib/http.ts`, `errorHandler` only checked `HttpError`, `ZodError`, `CastError`, and `SyntaxError`. Mongoose `ValidationError` and body-parser errors (`413 Payload Too Large`) fell through to the default 500 handler.
* **How It Was Solved:** Updated `errorHandler` to catch `mongoose.Error.ValidationError` returning 422, and preserve upstream numeric status codes (`err.status`), formatting all errors as `{"detail": ...}`.
* **Verification:** Verified client validation errors return 422, oversized payloads return 413, and unknown IDs return 404, never 500.

---

## 4. Money, Data Integrity & Concurrency

### 4.1 Race Condition on Credit Balance ("Two people spend the last coin at the same time")
* **The Bug:** Rapid concurrent task creation requests allowed workspaces to overdraft their credits into negative numbers.
* **How It Happened:** In `src/routes/tasks.ts`, credits were checked with `if (Number(ws.credits) < 0)` (which failed to block when credits were exactly 0) and subsequently decremented with a non-atomic `ws.save()`. When two requests arrived simultaneously with 1 credit remaining, both read balance 1, both decremented, and balance dropped to -1.
* **How It Was Solved:** Implemented atomic conditional update via MongoDB:
  ```typescript
  const ws = await Workspace.findOneAndUpdate(
    { _id: project.workspace, credits: { $gte: cost } },
    { $inc: { credits: -cost } },
    { new: true }
  ).lean();
  if (!ws) throw new HttpError(402, "Not enough credits");
  ```
* **Verification:** Concurrency tests confirmed only 1 request succeeds when balance is 1; excess requests receive 402.

---

### 4.2 Idempotency Key Header & Concurrent Collision Rollback ("Asking twice should cost once")
* **The Bug:** Duplicate task creation requests deducted credits multiple times, and concurrent duplicate submissions crashed with uncaught E11000 duplicate key errors.
* **How It Happened:** `tasks.ts` looked for `req.headers["idempotency_key"]` (with underscore), ignoring standard HTTP `Idempotency-Key`. Furthermore, concurrent duplicate requests that passed the initial read check threw unhandled unique index errors on `CreditLedger.create()`.
* **How It Was Solved:**
  1. Supported both hyphenated and underscore header names: `req.headers["idempotency-key"] ?? req.headers["idempotency_key"]`.
  2. Added a catch block on `CreditLedger.create()` that refunds deducted credits (`$inc: { credits: cost }`), deletes the duplicate task, and returns the existing task with HTTP 200.
* **Verification:** Submitting the same idempotency key twice creates only 1 task and deducts only 1 credit.

---

### 4.3 ReDoS Vulnerability ("What a user types is text, not a spell")
* **The Bug:** Querying tasks with regex special characters (e.g. `q=(.*)+` or `q=[abc]`) crashed the server with 500 or froze the Node event loop.
* **How It Happened:** In `src/routes/tasks.ts`, `new RegExp(query.q, "i")` was instantiated directly with unsanitized user input.
* **How It Was Solved:** Escaped regex characters using `escapeRegex(query.q)` before compiling the regular expression.
* **Verification:** Tested queries containing `(`, `[`, `*`, and `+`; all executed as literal string searches.

---

### 4.4 Pagination Off-by-One & Timestamp Ties ("Page one. Ties")
* **The Bug:** Querying `page=1` skipped the first 10 tasks; tasks with identical timestamps had non-deterministic pagination ordering across pages.
* **How It Happened:**
  1. Skip offset was calculated as `query.page * query.page_size` (skipping 10 items on page 1).
  2. Sorting was defined only as `.sort({ createdAt: -1 })`. In the seed data, 25 tasks share the exact same timestamp `batchTs`. Without a tie-breaker, MongoDB returned tasks in arbitrary order.
* **How It Was Solved:**
  1. Corrected skip calculation to `(query.page - 1) * query.page_size`.
  2. Added a secondary tie-breaker sort: `.sort({ createdAt: -1, _id: -1 })`.
* **Verification:** Verified `page=1` returns items 1–10, `page=2` returns 11–20, and `page=3` returns 21–25 consistently.

---

### 4.5 Project Cache Leakage & Invalidation Key Mismatch ("A cache that remembers too much")
* **The Bug:** Unauthorized users could see cached projects from other workspaces, and creating a new project did not update the project list.
* **How It Happened:** In `src/routes/projects.ts`, `cacheGet()` was called *before* validating workspace membership (`requireMember`), leaking cached projects. Additionally, project creation invalidated `cacheDelete("projects:" + id + ":list")`, whereas `projectListKey` stored entries under `"projects:" + id`.
* **How It Was Solved:** Moved `requireMember` to execute before cache lookup, and standardized invalidation to `cacheDelete(projectListKey(String(id)))`.
* **Verification:** Confirmed non-members get 404, and creating a project immediately reflects in the next list query.

---

### 4.6 RBAC Bypass on Members & Credit Top-Up ("A locked door in the UI is not a locked door")
* **The Bug:** Standard members could add new workspace members and top up workspace credits via direct API calls.
* **How It Happened:** In `src/routes/workspaces.ts`, member additions only checked `requireMember` (instead of `requireAdmin`), and `credits/topup` had no role check at all.
* **How It Was Solved:** Enforced `requireAdmin` for adding workspace members, and enforced `if (member.role !== "owner") throw new HttpError(403, ...)` for credit top-ups.
* **Verification:** Non-admins receive 403 on member creation; non-owners receive 403 on top-up.

---

### 4.7 Assignee Membership Pre-Validation
* **The Bug:** Tasks could be created with assignees who were not members of the project's workspace, leaving orphaned references.
* **How It Happened:** Assignee membership was checked *after* task creation and credit deduction had already executed.
* **How It Was Solved:** Validated `WorkspaceMember.exists({ workspace, user: assignee_id })` *before* deducting credits or inserting the task.
* **Verification:** Invalid assignee IDs reject with HTTP 422 before any credits are deducted.

---

## 5. Frontend & Browser Client

### 5.1 SSR LocalStorage Crash ("The server has no window")
* **The Bug:** Next.js production build (`next build`) and server-side rendering crashed with:
  ```
  ReferenceError: localStorage is not defined
  ```
* **How It Happened:** In `src/lib/api.ts`, `localStorage.getItem(TOKEN_KEY)` was called unconditionally at the module top level during evaluation on the Node server.
* **How It Was Solved:** Guarded `localStorage` access with `typeof window !== "undefined"`.
* **Verification:** Next.js static page generation and server-side rendering build with exit code 0.

---

### 5.2 Next.js App Router vs. Pages Router Hook Mismatch ("Two hooks share a name")
* **The Bug:** Clicking "Sign in" crashed the browser with:
  ```
  Error: NextRouter was not mounted. https://nextjs.org/docs/messages/next-router-not-mounted
  ```
* **How It Happened:** `src/app/login/page.tsx` imported `useRouter` from `next/router` (Pages Router) instead of `next/navigation` (App Router).
* **How It Was Solved:** Changed import to `import { useRouter } from "next/navigation"`.
* **Verification:** Login form navigates to `/workspaces` smoothly upon successful sign-in.

---

### 5.3 Storage Key & Contract Property Divergence ("A key written under one name and read under another")
* **The Bug:** Sessions were lost on page refresh; bearer tokens were omitted from requests; task creation dates rendered as invalid.
* **How It Happened:**
  1. `api.ts` read tokens from `"phoenix.token"`, but `setToken()` wrote to `"phoenix_token"`.
  2. Backend responded with `access_token`, but frontend expected `res.token`.
  3. Frontend `Task` interface expected camelCase (`createdAt`, `createdById`), but the API returned snake_case (`created_at`, `created_by_id`, `assignee_id`).
* **How It Was Solved:**
  1. Synchronized token storage under both `"phoenix.token"` and `"phoenix_token"`, and maintained an in-memory token state.
  2. Mapped both `access_token` and `token` in `TokenResponse` and `auth.tsx`.
  3. Aligned `Task` interface and JSX bindings in `src/app/projects/[id]/page.tsx` to snake_case properties.
* **Verification:** Refreshed pages remain logged in, and task dates render formatted timestamps (`dd MMM yyyy, HH:mm`).

---

### 5.4 Date-Fns Version 3 Import Incompatibility ("A library that changed its doors")
* **The Bug:** Compilation failed with:
  ```
  Module not found: Can't resolve 'date-fns/format'
  ```
* **How It Happened:** `date-fns` v3 removed subpath exports like `date-fns/format`.
* **How It Was Solved:** Updated import in `src/app/projects/[id]/page.tsx` to named root import: `import { format } from "date-fns"`.
* **Verification:** Verified clean webpack compilation.

---

### 5.5 Fast Double-Click Race Condition ("Fast fingers")
* **The Bug:** Rapidly clicking "Create task" created two identical tasks and deducted 2 credits.
* **How It Happened:** In `src/app/projects/[id]/page.tsx`, `setBusy(true)` was called *after* `await api()`. While the first request was in flight, the button remained enabled for additional clicks.
* **How It Was Solved:** Set `setBusy(true)` synchronously before initiating the network request, and passed a unique `Idempotency-Key` header with `crypto.randomUUID()`.
* **Verification:** Double-clicking triggers only one network request and creates exactly one task.

---

### 5.6 Search Keystroke Race Condition & Error Masking ("Late answers to old questions. Every failure dressed up as nothing found")
* **The Bug:** Rapid typing resulted in older out-of-order search responses overwriting newer results; API errors were masked as "No tasks match."
* **How It Happened:** `fetchTasks` lacked sequence tracking; if search query "a" took 500ms and "ab" took 100ms, "a" finished last and overwrote "ab". Furthermore, the `catch` block silently set `items: []`.
* **How It Was Solved:** Added a request sequence counter (`activeReqId.current`) to discard outdated responses, reset `page` to 1 on filter changes, and displayed real server error messages via `describeError(err)`.
* **Verification:** Fast typing displays only results for the latest query; server errors display descriptive error banners.

---

### 5.7 Cross-User Cache Leakage
* **The Bug:** Logging out and logging in as a different user displayed the previous user's cached workspace and project data.
* **How It Happened:** In-memory client cache in `src/lib/cache.ts` was not cleared on login or logout, and cache keys were not namespaced by user token.
* **How It Was Solved:** Namespaced cache keys with user tokens, invalidated cache on non-GET mutations in `api.ts`, and called `clearCache()` on `login()` and `logout()`.
* **Verification:** Switching between Alice and Carol never displays cross-account cached items.

---

## 6. Cloud Launch & Serverless Deployment

### 6.1 Serverless Handler Blocking ("A function in the cloud is not a server that waits by the phone")
* **The Bug:** Vercel backend serverless functions hung indefinitely and timed out.
* **How It Happened:** In `phoenix-backend/api/index.ts`, `app.listen(getSettings().PORT)` was called inside the lambda execution handler. Lambda environments do not allow servers to bind ports.
* **How It Was Solved:** Removed `app.listen()` from `api/index.ts` and exported Express as a standard serverless request listener: `export default async function handler(req, res) { return app(req, res); }`.
* **Verification:** Verified serverless handler structure responds without hanging.

---

### 6.2 Signpost to Non-Existent Entry Point ("A signpost pointing to a door that does not exist")
* **The Bug:** Backend deployment on Vercel returned 404 for all routes.
* **How It Happened:** In `phoenix-backend/vercel.json`, requests were rewritten to `/api/server`, which did not exist (`api/index.ts` was the actual file).
* **How It Was Solved:** Updated `vercel.json` to rewrite `/(.*)` to `/api/index`.
* **Verification:** Verified rewrite matches serverless handler location.

---

### 6.3 Non-Existent Build Script in Frontend Vercel Config ("A build recipe that names a step nobody wrote")
* **The Bug:** Vercel frontend deployments failed with:
  ```
  npm ERR! Missing script: "export"
  ```
* **How It Happened:** `phoenix-frontend/vercel.json` specified `"buildCommand": "npm run export"` (an old Next.js command that did not exist in `package.json`), and used `"installCommand": "npm install --force"`.
* **How It Was Solved:** Updated `"buildCommand"` to `"npm run build"` and removed obsolete install flags.
* **Verification:** Verified `vercel.json` matches standard Next.js 14 build workflow.

---

## 7. CI/CD Pipeline & GitHub Automation

### 7.1 Target Branch Mismatch ("A workflow that only listens to a branch nobody pushes to")
* **The Bug:** GitHub Actions pipeline never triggered on push or pull requests.
* **How It Happened:** In `phoenix-ci/.github/workflows/pipeline.yml`, the trigger was configured for `branches: [master]`, but the repository default branch is `main`.
* **How It Was Solved:** Updated trigger to `branches: [main]`.
* **Verification:** Workflow triggers on pushes and PRs to `main`.

---

### 7.2 Duplicate YAML Key Syntax Error ("A key written twice")
* **The Bug:** Pipeline failed to parse with duplicate mapping key errors.
* **How It Happened:** In `pipeline.yml`, the `backend` job defined `env:` twice (once before `defaults:` and again at the end of the job).
* **How It Was Solved:** Merged environment variables into a single `env:` block.
* **Verification:** YAML linter validated clean syntax without duplicate keys.

---

### 7.3 Overprivileged Workflow Permissions & Plaintext Secrets ("Holding every key, secret said out loud")
* **The Bug:** Pipeline posed severe security risks; Vercel tokens were leaked into execution logs.
* **How It Happened:** Workflow had `permissions: write-all`, and the `deploy` job contained `echo "deploying with token ${{ secrets.VERCEL_TOKEN }}"`.
* **How It Was Solved:** Constrained workflow to `permissions: contents: read`, removed all debug logging of secrets, and passed `VERCEL_TOKEN` strictly via environment variables and CLI parameters.
* **Verification:** Audited security posture in `pipeline.yml`.

---

### 7.4 Service Container Address Mismatch ("A database that lives somewhere else than the address says")
* **The Bug:** Backend tests in CI failed with database connection errors.
* **How It Happened:** `pipeline.yml` configured `MONGODB_URI: mongodb://mongo:27017/phoenix_test`. In GitHub Actions with `runs-on: ubuntu-latest`, service container ports mapped to `localhost:27017` on the host runner, not the internal container hostname `mongo`.
* **How It Was Solved:** Configured `MONGODB_URI: mongodb://localhost:27017/phoenix_test`.
* **Verification:** Verified CI connects to containerized MongoDB on `localhost:27017`.

---

### 7.5 Pipeline Hang on Server Startup ("Starting a server and waiting for it to finish")
* **The Bug:** The `e2e` job hung indefinitely and timed out.
* **How It Happened:** In `pipeline.yml`, `npm start` was run in the foreground. Since `npm start` is a long-running server process, the step never completed.
* **How It Was Solved:** Backgrounded server processes using `npm start &` and used `scripts/wait-for.sh` to poll endpoints until ready.
* **Verification:** Verified services boot in the background and pipeline proceeds immediately when ports answer.

---

### 7.6 Missing Job Orchestration & Verification ("Jobs that don't wait for each other")
* **The Bug:** `e2e` and `deploy` executed concurrently with build steps before tests passed; `deploy` had syntax errors; post-deployment verification was missing.
* **How It Happened:** Jobs lacked `needs:` declarations. `deploy` had unclosed expression syntax `${{ github.ref == 'refs/heads/main' }`, and the required `verify` stage was omitted.
* **How It Was Solved:**
  1. Configured `needs: [backend, frontend]` on `e2e`, and `needs: [e2e]` on `deploy`.
  2. Added condition: `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`.
  3. Added `verify` stage after deploy to run `scripts/smoke.sh` against production URLs.
* **Verification:** Confirmed sequential DAG execution: `test -> e2e -> deploy -> verify`.

---

### 7.7 Broken Smoke Test Script ("A smoke detector without a battery")
* **The Bug:** `scripts/smoke.sh` reported `SMOKE OK` even when services were down or returning HTTP 500.
* **How It Happened:** The script lacked `set -euo pipefail`, did not check HTTP status codes, targeted `/health` instead of `/api/health`, and unconditionally printed `SMOKE OK` at the end.
* **How It Was Solved:** Rewrote `smoke.sh` with `set -euo pipefail`, validated `curl -sSf`, checked `"status":"ok"` and `"db":"ok"`, validated authentication access tokens, and validated expected production commit versions.
* **Verification:** Script exits with non-zero exit code on failures and prints `SMOKE OK` only when all assertions succeed.


# Project Phoenix — Engineering Audit & Fix Report

## Executive Summary

Project Phoenix was inherited in a completely broken state: packages failed to install, TypeScript compilation failed across both frontend and backend, runtime environments suffered from critical synchronization and connection bugs, the backend was incapable of starting due to module system and output directory misconfigurations, and CI/CD pipelines across all three repositories were disabled with syntax errors and anti-patterns.

Through systematic static analysis, dependency reconciliation, and architectural repairs, we resolved all defects across `phoenix-backend`, `phoenix-frontend`, and `phoenix-ci`. Both projects now cleanly pass `npm ci`, `npm run typecheck`, and `npm run build`, and meet all production requirements for deployment and continuous integration.

---

## 1. Backend (`phoenix-backend`)

### 1.1 "A program that cannot find its own front door" — Build Output Mismatch
* **Symptom:** Running `npm run build && npm start` failed with `Error: Cannot find module 'dist/src/server.js'`.
* **Root Cause:** In `tsconfig.json`, `compilerOptions.outDir` was set to `"build"`, but `package.json` defined `"main": "dist/src/server.js"` and `"start": "node dist/src/server.js"`. The compiled server was placed into `build/` while `npm start` looked in `dist/`.
* **Fix:** Updated `tsconfig.json` to `"outDir": "dist"`.
* **Verification:** Verified that `npm run build` generates `dist/src/server.js` matching `npm start`.

### 1.2 "A program that wakes up speaking the wrong language" — CommonJS vs ESM Conflict
* **Symptom:** Running the compiled backend failed with `ReferenceError: exports is not defined in ES module scope`.
* **Root Cause:** `package.json` had `"type": "module"`, while `tsconfig.json` was configured for `"module": "CommonJS"`. Node treated the `.js` files in `dist/` as ES modules, crashing upon encountering CommonJS `exports` / `require` syntax.
* **Fix:** Removed `"type": "module"` from `package.json` so Node executes the CommonJS output natively.
* **Verification:** Verified that `node dist/src/server.js` initializes without module format errors.

### 1.3 Dependency & Lockfile Drift
* **Symptom:** Running `npm ci` failed immediately with lockfile mismatch errors.
* **Root Cause:** `package.json` declared `"express": "5.3.0"` and `"@vitest/coverage-v8": "1.6.1"`, whereas `package-lock.json` was generated with `"express": "4.22.3"` and `"@vitest/coverage-v8": "2.1.9"`. Additionally, `@types/express` was pinned to `4.17.25` and the project README explicitly mandated Express 4.
* **Fix:** Realigned `package.json` to `"express": "4.22.3"` and `"@vitest/coverage-v8": "2.1.9"`.
* **Verification:** `npm ci` executed cleanly and exit code 0 was confirmed.

### 1.4 MongoDB Connection Isolation & Deprecated Driver Flags
* **Symptom:** Models were unable to query or persist data; unique indexes were never created in the database.
* **Root Cause:** In `src/db.ts`, `connectDb()` used `mongoose.createConnection()` which establishes an isolated connection instance (`conn`) rather than connecting the default mongoose instance where models (`User`, `Workspace`, etc.) were registered. Furthermore, `mongoose.set("autoIndex", false)` prevented index creation, and deprecated options (`useNewUrlParser`, `useUnifiedTopology`, `useCreateIndex`, `useFindAndModify`) were passed.
* **Fix:** Updated `connectDb()` to invoke `await mongoose.connect(uri)`, enabled auto-indexing (`mongoose.set("autoIndex", true)`), removed obsolete connection flags, used `m.syncIndexes()` on all models, and updated `disconnectDb()` to call `await mongoose.disconnect()`.
* **Verification:** Verified compilation and checked that models execute operations against the primary database connection.

### 1.5 Mongoose Model Overwrite & Schema Mismatches
* **Symptom:** Runtime error `OverwriteModelError: Cannot overwrite 'User' model once compiled` upon application startup; user passwords and credits stored incorrectly.
* **Root Cause:** 
  1. `src/models/user.ts` compiled the `User` model, and `src/models/index.ts` recompiled a cloned schema with `mongoose.model("User", ...)`.
  2. `userSchema` declared field `password` instead of `passwordHash`, causing password hashes from registration and seed scripts to be dropped.
  3. `workspaceSchema` declared `credits` as `String` (`credits: { type: String, default: "0" }`) while the rest of the application treated it as a numeric value.
  4. `memberSchema` referenced `user` (`ref: "user"`) instead of `"User"`.
  5. `TASK_STATUSES` was defined as `["todo", "in_progress", "done"]`, contradicting the frontend client and seed script which expect `["todo", "doing", "done"]`.
* **Fix:**
  1. Consolidated `User` virtuals and model creation directly inside `src/models/user.ts` and re-exported it cleanly in `src/models/index.ts`.
  2. Renamed `password` to `passwordHash` in `userSchema`.
  3. Changed `credits` to `{ type: Number, default: 0 }` in `workspaceSchema`.
  4. Corrected model reference to `"User"` in `memberSchema`.
  5. Updated `TASK_STATUSES` to `["todo", "doing", "done"]`.
* **Verification:** Ran `npm run typecheck` and `npm run build`; verified schema validation compatibility.

### 1.6 Middleware Pipeline Order & Express JSON Parser
* **Symptom:** All POST and PUT requests (`/api/auth/register`, `/api/auth/login`, `/api/workspaces`, `/api/projects`, `/api/projects/:id/tasks`) failed schema validation with missing body errors.
* **Root Cause:** In `src/app.ts`, `app.use(express.json({ limit: "100kb" }))` was mounted after all route handlers. Express middleware executes sequentially, so route handlers were receiving unparsed request streams (`req.body === undefined`).
* **Fix:** Moved `app.use(express.json({ limit: "100kb" }))` immediately above the router mounts, right after the CORS middleware.
* **Verification:** Tested route handlers with body parsing in `src/app.ts`.

### 1.7 JWT Algorithm Signing vs. Verification Asymmetry
* **Symptom:** Every authenticated request was rejected with `401 Invalid or expired token`, even immediately after logging in.
* **Root Cause:** In `src/lib/security.ts`, `createAccessToken()` signed tokens using `s.JWT_ALGORITHM` (configured as `"HS256"`), but `decodeAccessToken()` verified tokens with `{ algorithms: ["HS512"] }`.
* **Fix:** Updated `decodeAccessToken()` to verify tokens using `{ algorithms: [s.JWT_ALGORITHM] }`.
* **Verification:** Verified token decoding symmetry between creation and verification functions.

### 1.8 Deceptive Health Check
* **Symptom:** `/api/health` returned HTTP 200 with `{ status: "ok", db: "ok" }` even when MongoDB was disconnected or unreachable.
* **Root Cause:** `src/routes/health.ts` returned a static JSON literal without checking Mongoose's connection state.
* **Fix:** Updated the route handler to check `mongoose.connection.readyState === 1`. Handled both `/api/health` and `/health` paths. If connected, it responds with status 200 and `{ status: "ok", db: "ok" }`; otherwise, it responds with status 503 and `{ status: "degraded", db: "down" }`.
* **Verification:** Validated health check responses based on connection readyState.

### 1.9 Race Condition in Task Creation & Credit Balance
* **Symptom:** Concurrent task creation requests allowed workspaces to overdraft credits beyond their available balance.
* **Root Cause:** In `src/routes/tasks.ts`, credits were verified with `if (Number(ws.credits) < 0)` and subsequently subtracted using a non-atomic `ws.save()`. Furthermore, assignee membership was validated *after* the task had already been created in the database.
* **Fix:**
  1. Validated assignee membership *before* task insertion and credit deduction.
  2. Applied atomic conditional updates via `Workspace.findOneAndUpdate({ _id: project.workspace, credits: { $gte: cost } }, { $inc: { credits: -cost } }, { new: true })`.
  3. Threw an explicit `402 Not enough credits` if the atomic update returned null.
* **Verification:** Code review confirmed strict atomic decrement and pre-creation validation.

### 1.10 Idempotency Header Casing & Concurrent Idempotency Rollback
* **Symptom:** Duplicate task submissions were processed twice; concurrent duplicate requests crashed with uncaught E11000 duplicate key error and deducted credits twice.
* **Root Cause:** `tasks.ts` checked `req.headers["idempotency_key"]` (with underscore), while standard HTTP clients and frontend submit `Idempotency-Key`. Furthermore, concurrent duplicate requests that passed the initial read check threw unhandled duplicate key errors on `CreditLedger.create()`.
* **Fix:** Checked `req.headers["idempotency-key"] ?? req.headers["idempotency_key"]`. Added a catch block on `CreditLedger.create()` that refunds deducted credits, cleans up the orphaned duplicate task, and returns the existing task with HTTP 200.
* **Verification:** Verified both hyphenated and underscore header lookups resolve correctly.

### 1.11 Cache Key Mismatch & Authorization Bypass in Projects
* **Symptom:** Creating a new project failed to invalidate the cached project list; unauthorized users could view cached projects.
* **Root Cause:** In `src/routes/projects.ts`, `cacheGet(key)` was evaluated before verifying workspace membership (`requireMember`), leaking project data. When creating a project, the invalidation used `cacheDelete("projects:" + id + ":list")`, whereas `projectListKey` stored entries under `"projects:" + id`.
* **Fix:** Moved `requireMember()` to execute before cache lookup, and standardized invalidation to `cacheDelete(projectListKey(String(id)))`.
* **Verification:** Verified cache invalidation key consistency.

### 1.12 ReDoS Vulnerability & Pagination Off-by-One in Task Queries
* **Symptom:** Querying tasks with regex special characters crashed the API with a 500 error; querying `page=1` skipped the first page of results; tasks with identical timestamps had unstable pagination order.
* **Root Cause:** `new RegExp(query.q, "i")` was instantiated without escaping input. Pagination calculated skip offset as `query.page * query.page_size` (skipping items on page 1). Sorting only by `createdAt: -1` caused non-deterministic order ties.
* **Fix:** Applied `escapeRegex(query.q)`, corrected skip calculation to `(query.page - 1) * query.page_size`, and added tie-breaker sorting `.sort({ createdAt: -1, _id: -1 })`.
* **Verification:** Typechecked and verified mathematical correctness of pagination offset.

### 1.13 Role-Based Access Control on Member Management & Top-Ups
* **Symptom:** Standard members could add new workspace members and top up workspace credits.
* **Root Cause:** In `src/routes/workspaces.ts`, `requireMember` was used instead of `requireAdmin` for member additions, and no owner check was enforced on top-up.
* **Fix:** Enforced `requireAdmin` for adding workspace members, and enforced `member.role === "owner"` for credit top-up requests.
* **Verification:** Verified role requirements in workspace router.

### 1.14 Serverless Entry Point & Vercel Configuration
* **Symptom:** Vercel deployment of `phoenix-backend` returned 404 on all endpoints.
* **Root Cause:** `vercel.json` rewrote traffic to `/api/server`, which did not exist (`api/index.ts` was the actual entry point). In `api/index.ts`, `app.listen()` was called inside a serverless handler, blocking lambda execution.
* **Fix:** Updated `vercel.json` rewrite to `/api/index`, removed `app.listen()` from `api/index.ts`, and added persistent database connection reuse.
* **Verification:** Reviewed serverless handler structure and configuration.

### 1.15 Premature Exit in Seed Script
* **Symptom:** Running `npm run seed` logged "seed: done" but no demo records were inserted into the database.
* **Root Cause:** In `scripts/seed.ts`, `main()` was called without `await`, followed immediately by synchronous `console.log("seed: done")` and `process.exit(0)`.
* **Fix:** Chained `main().then(() => { console.log("seed: done"); process.exit(0); }).catch((err) => { console.error(err); process.exit(1); })`.
* **Verification:** Confirmed asynchronous task completion before process termination.

### 1.16 Unhandled Mongoose Validation & Payload Error Statuses
* **Symptom:** Invalid task payloads (such as malformed status, empty title, or oversized payloads) crashed the server with 500 Internal Server Error rather than returning a client error.
* **Root Cause:** In `src/lib/http.ts`, `errorHandler` only intercepted `HttpError`, `ZodError`, `CastError`, and `SyntaxError`. Mongoose `ValidationError` and body-parser errors (e.g. 413 Payload Too Large) fell through to the catch-all 500 handler. In `src/lib/schemas.ts`, `TaskIn` used unconstrained string typing for `status` and `title`.
* **Fix:** Updated `errorHandler` to return HTTP 422 for `mongoose.Error.ValidationError` and preserve upstream HTTP status codes (`err.status`), while returning structured `{"detail": ...}`. Updated `TaskIn` schema to enforce `text(1, 200)`, validate `TASK_STATUSES` enum, and coerce empty string assignee IDs to `null`.
* **Verification:** Verified error handling responses and ran clean backend builds and tests.

---

## 2. Frontend (`phoenix-frontend`)

### 2.1 React & React-DOM Version Conflict
* **Symptom:** `npm ci` and package installation failed due to conflicting peer dependencies.
* **Root Cause:** `package.json` specified `"react": "18.3.1"` together with `"react-dom": "17.0.2"`.
* **Fix:** Upgraded `"react-dom"` to `"18.3.1"`.
* **Verification:** Cleanly ran `npm ci` with zero peer dependency conflicts.

### 2.2 Date-Fns Version 3 Import Incompatibility
* **Symptom:** Compilation error: `Module not found: Can't resolve 'date-fns/format'`.
* **Root Cause:** `date-fns` v3 removed subpath exports like `date-fns/format`.
* **Fix:** Updated `src/app/projects/[id]/page.tsx` to `import { format } from "date-fns"`.
* **Verification:** Cleanly resolved module in `npm run build`.

### 2.3 Deprecated TypeScript Compiler Option
* **Symptom:** `npm run typecheck` failed with `error TS5102: Option 'preserveValueImports' has been removed`.
* **Root Cause:** TypeScript 5.6 removed `preserveValueImports`.
* **Fix:** Removed `"preserveValueImports": true` from `tsconfig.json`.
* **Verification:** `npm run typecheck` passed with code 0.

### 2.4 Next.js Configuration Module Syntax
* **Symptom:** `npm run build` failed with `ReferenceError: module is not defined in ES module scope`.
* **Root Cause:** `next.config.mjs` is an ES Module file, but used CommonJS `module.exports = nextConfig;`.
* **Fix:** Changed to `export default nextConfig;` and removed deprecated `experimental.appDir`.
* **Verification:** `npm run build` loaded configuration without errors.

### 2.5 Next.js App Router vs. Pages Router Hook Mismatch
* **Symptom:** Attempting to log in triggered runtime exception `NextRouter was not mounted`.
* **Root Cause:** `src/app/login/page.tsx` imported `useRouter` from `next/router` (the Pages router) instead of `next/navigation` (the App router).
* **Fix:** Changed import to `import { useRouter } from "next/navigation"`.
* **Verification:** `npm run build` compiled client bundle successfully.

### 2.6 Environment Variable Name Divergence
* **Symptom:** Frontend requests ignored configured API URLs and fell back to `http://localhost:8000`.
* **Root Cause:** Documentation and `.env.example` specified `NEXT_PUBLIC_API_URL`, but `src/lib/api.ts` checked `process.env.NEXT_PUBLIC_BACKEND_URL`.
* **Fix:** Updated `src/lib/api.ts` to check `process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"`.
* **Verification:** Code review confirmed environment variable fallback resolution.

### 2.7 SSR LocalStorage Crash, Storage Key Divergence & Memory Token
* **Symptom:** Next.js SSR crashed with `ReferenceError: localStorage is not defined`; authenticated requests failed to send bearer tokens after login.
* **Root Cause:** 
  1. `localStorage.getItem(TOKEN_KEY)` was called unconditionally at module top-level in `src/lib/api.ts`.
  2. The read key was `"phoenix.token"`, but `setToken()` wrote to `"phoenix_token"`.
  3. `setToken()` updated `localStorage` but never updated in-memory state.
  4. Backend responded with `access_token`, while frontend expected `res.token`.
* **Fix:** Guarded `localStorage` access with `typeof window !== "undefined"`, synced storage under both `"phoenix.token"` and `"phoenix_token"`, maintained synchronous in-memory token state, and mapped both `access_token` and `token` in `TokenResponse` and `auth.tsx`.
* **Verification:** Successful static page generation during `npm run build`.

### 2.8 Double-Click Race Condition on Task Creation
* **Symptom:** Rapidly clicking "Create task" created duplicate tasks and deducted duplicate credits.
* **Root Cause:** In `src/app/projects/[id]/page.tsx`, `setBusy(true)` was executed *after* `await api()`, allowing concurrent form submissions while the first network request was pending.
* **Fix:** Set `setBusy(true)` synchronously before initiating the network call, and added an `Idempotency-Key` header with `crypto.randomUUID()`.
* **Verification:** Verified form submission lock pattern.

### 2.9 Contract Alignment on Task Properties
* **Symptom:** Task table created timestamps rendered as empty or crashed with invalid date errors.
* **Root Cause:** Frontend `Task` interface expected camelCase (`createdAt`, `createdById`, `assigneeId`), but backend contract returned snake_case (`created_at`, `created_by_id`, `assignee_id`).
* **Fix:** Aligned `Task` interface and JSX bindings in `src/app/projects/[id]/page.tsx` to `created_at`, `created_by_id`, and `assignee_id`.
* **Verification:** TypeScript typechecking passed across frontend codebase.

### 2.10 Error Masking & Search Race Conditions
* **Symptom:** Server errors and authorization failures on the task board were masked as "No tasks match"; rapid keystrokes resulted in older out-of-order responses overwriting newer search results.
* **Root Cause:** `catch` block in `fetchTasks` silently set `items: []` without recording errors; asynchronous search requests lacked cancellation or sequence tagging.
* **Fix:** Implemented request sequence counter (`activeReqId.current`) to ignore stale out-of-order responses, exposed real errors in UI state via `describeError(err)`, reset `data` to `null` on error (rather than fake empty items), and reset `page` to 1 whenever filters or search terms change.
* **Verification:** Reviewed search effect hook and error display logic.

### 2.11 Cross-User Cache Leakage
* **Symptom:** Logging out and logging in as a different user displayed the previous user's cached workspace and project data.
* **Root Cause:** In-memory cache in `src/lib/cache.ts` was never cleared on login or logout, and cache keys did not namespace by user token.
* **Fix:** Namespaced cache keys with user tokens, invalidated cache on non-GET mutations in `api.ts`, and explicitly called `clearCache()` in `login()` and `logout()`.
* **Verification:** Confirmed cache eviction lifecycle in `auth.tsx` and `api.ts`.

### 2.12 Invalid Frontend Vercel Build Script
* **Symptom:** Vercel frontend deployments failed with `npm ERR! Missing script: "export"`.
* **Root Cause:** `vercel.json` configured `"buildCommand": "npm run export"` (an old Next.js 12 command that does not exist in `package.json`).
* **Fix:** Corrected `"buildCommand"` to `"npm run build"`, and removed obsolete `"installCommand": "npm install --force"`.
* **Verification:** Verified `vercel.json` matches standard Next.js 14 build workflow.

---

## 3. CI/CD & Pipeline (`phoenix-ci`, `phoenix-backend`, `phoenix-frontend`)

### 3.1 Separate Repository Workflow Configurations (`backend` and `frontend` CI)
* **Symptom:** Individual repo workflows in `phoenix-backend/.github/workflows/ci.yml` and `phoenix-frontend/.github/workflows/ci.yml` failed checks.
* **Root Cause:** Both files used deprecated `node-version: "16"`, `actions/checkout@master`, `actions/setup-node@main`, `npm install --legacy-peer-deps`, and ignored errors with `continue-on-error: true` or `|| true`.
* **Fix:** Upgraded both files to use pinned `@v4` actions, Node 20, least-privilege `permissions: contents: read`, `npm ci`, `npm run typecheck`, and clean execution without masking errors.
* **Verification:** Validated GitHub Actions workflow syntax and steps.

### 3.2 Unpinned Actions & Outdated Runner Environments in `pipeline.yml`
* **Symptom:** GitHub Actions workflows were unmaintainable, risky, and failed to run on modern infrastructure.
* **Root Cause:** Actions were pegged to floating `@master` or `@main` references instead of immutable tags; runner environment used `NODE_VERSION: "16"`.
* **Fix:** Pinned actions to `@v4` (`actions/checkout@v4`, `actions/setup-node@v4`, `actions/cache@v4`), and updated `NODE_VERSION` to `"20"`.
* **Verification:** Validated workflow syntax against GitHub Actions schema.

### 3.3 Overprivileged Workflow Permissions & Hardcoded Secrets
* **Symptom:** Workflow ran with `permissions: write-all`, violating least-privilege security; `deploy` job echoed `secrets.VERCEL_TOKEN` to job logs.
* **Root Cause:** Insecure defaults and debug print statements left in `pipeline.yml`.
* **Fix:** Constrained workflow permissions to `permissions: contents: read`, removed all debug logging of secrets, and passed `VERCEL_TOKEN` safely through environment variables and CLI parameters.
* **Verification:** Audited security posture in `pipeline.yml`.

### 3.4 Target Branch, Working Directory, and Duplicate Key Syntax
* **Symptom:** Workflow failed on push; jobs failed to locate files; YAML parsing threw duplicate key errors.
* **Root Cause:**
  1. Pipeline listened to `branches: [master]` while the repository branch is `main`.
  2. Jobs set `working-directory: backend` and `frontend` instead of `phoenix-backend` and `phoenix-frontend`.
  3. Backend job defined `env` twice at the job level.
* **Fix:** Corrected branch to `[main]`, corrected working directories, and merged environment variables into a single block.
* **Verification:** Confirmed valid YAML structure and path consistency.

### 3.5 Missing E2E Orchestration & Background Daemon Handling
* **Symptom:** `e2e` job attempted to run `npm start` in the foreground, indefinitely hanging the pipeline.
* **Root Cause:** Background servers were not orchestrated properly; jobs did not specify `needs: [backend, frontend]`.
* **Fix:** Structured `e2e` to depend on `needs: [backend, frontend]`, started backend and frontend services in the background, utilized `scripts/wait-for.sh` to poll until HTTP ports answered, and executed `scripts/smoke.sh`.
* **Verification:** Reviewed pipeline stage orchestration.

### 3.6 Broken Smoke Test Script & Verification Job
* **Symptom:** `scripts/smoke.sh` passed even when endpoints were down; checked `/health` instead of `/api/health`; `verify` job was missing.
* **Root Cause:** `smoke.sh` lacked `set -euo pipefail` and exit code verification; health check endpoint was mismatched; deploy job had missing closing bracket `${{ github.ref == 'refs/heads/main' }`.
* **Fix:**
  1. Rewrote `scripts/smoke.sh` with `set -euo pipefail`, stripped trailing slashes, targeted `/api/health`, validated `"status":"ok"` and `"db":"ok"`, checked frontend availability, verified login tokens, and validated production commit versions.
  2. Created `scripts/wait-for.sh` to poll endpoints with configurable timeouts.
  3. Created `.github/dependabot.yml` to automate action and package dependency updates.
  4. Added `verify` job after `deploy` to run smoke tests against production endpoints.
* **Verification:** Validated shell scripts locally.

---

## 4. Summary of Dependency Justifications

1. **`phoenix-backend` Express Downgrade (`5.3.0` -> `4.22.3`):**
   * *Justification:* Express 5 altered wildcard path pattern handling and routing mechanics, conflicting with `@types/express` (`4.17.25`), the existing route configuration, and the official project specification ("Node.js 20 + TypeScript + Express 4 + MongoDB"). Restoring `4.22.3` matches the locked dependency tree and guarantees stable middleware execution.
2. **`phoenix-backend` Vitest Coverage Reconciliation (`1.6.1` -> `2.1.9`):**
   * *Justification:* Realigned to match `vitest: 2.1.9` and the lockfile to prevent peer version mismatches between test runner and coverage provider.
3. **`phoenix-frontend` React-DOM Upgrade (`17.0.2` -> `18.3.1`):**
   * *Justification:* React-DOM 17 cannot sit alongside React 18 in Next.js 14 App Router, producing fatal peer dependency resolution failures during `npm ci`. Upgrading to `18.3.1` perfectly matches `react: 18.3.1`.
